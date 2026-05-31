import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

export const AFRICA_CDC_OPPORTUNITIES_URL = "https://africacdc.org/supply-chain-division/opportunities/";

type AfricaCdcDocumentLink = {
	label?: string;
	url: string;
};

type AfricaCdcOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		africaCdc: {
			sourceUrl: string;
			deadlineText?: string;
			reference?: string;
			bidType?: string;
			submissionEmail?: string;
			documentLinks: AfricaCdcDocumentLink[];
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
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>|<\/a>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function attrValue(attributes: string | undefined, name: string): string | undefined {
	const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attributes ?? "");
	return match?.[1] ? decodeEntities(match[1]).trim() : undefined;
}

function absoluteAfricaCdcUrl(rawUrl: string | undefined, sourceUrl = AFRICA_CDC_OPPORTUNITIES_URL): string | undefined {
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

function parseAfricaCdcDate(value: string | undefined): Date | undefined {
	const cleaned = stripHtml(value)
		.replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1")
		.replace(/,\s*$/, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return undefined;

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
	return /\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(url);
}

function collectDocumentLinks(htmlOrMarkdown: string, sourceUrl: string): AfricaCdcDocumentLink[] {
	const links: AfricaCdcDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of htmlOrMarkdown.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteAfricaCdcUrl(attrValue(match[1], "href"), sourceUrl);
		if (!url || seen.has(url) || !isDocumentUrl(url)) continue;
		seen.add(url);
		links.push({ label: stripHtml(match[2]) || attrValue(match[1], "title") || undefined, url });
	}
	for (const match of htmlOrMarkdown.matchAll(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g)) {
		const url = absoluteAfricaCdcUrl(match[2], sourceUrl);
		if (!url || seen.has(url) || !isDocumentUrl(url)) continue;
		seen.add(url);
		links.push({ label: cleanText(match[3] || match[1]) || undefined, url });
	}
	return links;
}

function submissionEmailFrom(value: string | undefined): string | undefined {
	return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(value ?? "")?.[0];
}

function normalizeReference(value: string | undefined): string | undefined {
	const cleaned = cleanText(value ?? "");
	return cleaned && !/^(?:n\/?a|none|not applicable)$/i.test(cleaned) ? cleaned : undefined;
}

function inferOpportunityType(title: string, bidType: string | undefined): OpportunityData["opportunityType"] {
	const haystack = `${title} ${bidType ?? ""}`.toLowerCase();
	if (/expression of interest|\beoi\b|call for expression/.test(haystack)) return "eoi";
	if (/request for proposals?|\brfp\b|consultancy/.test(haystack)) return "rfp";
	if (/call for applications|training/.test(haystack)) return "grant";
	return "tender";
}

function opportunityFromFields(
	fields: {
		title: string;
		portalUrl: string;
		deadline?: Date;
		deadlineText?: string;
		reference?: string;
		bidType?: string;
		summary?: string;
		documentLinks: AfricaCdcDocumentLink[];
	},
	sourceUrl: string
): AfricaCdcOpportunity {
	const submissionEmail = submissionEmailFrom(fields.summary);
	const primaryDocument = fields.documentLinks[0]?.url;
	const reference = normalizeReference(fields.reference);
	const referenceSlug = slugify(reference ?? "");
	return {
		title: fields.title,
		source: "africa_cdc",
		sourceId: `africa-cdc-${referenceSlug || slugify(fields.title) || "opportunity"}`,
		noticeId: reference,
		organization: "Africa Centres for Disease Control and Prevention (Africa CDC)",
		countryRegion: "Africa",
		category: fields.bidType ?? "Supply Chain Division opportunity",
		opportunityType: inferOpportunityType(fields.title, fields.bidType),
		deadline: fields.deadline,
		portalUrl: fields.portalUrl,
		documentUrl: primaryDocument,
		rfpLink: primaryDocument ?? fields.portalUrl,
		projectSummary: [
			fields.deadlineText ? `Deadline: ${fields.deadlineText}.` : undefined,
			reference ? `Reference: ${reference}.` : undefined,
			fields.bidType ? `Bid type: ${fields.bidType}.` : undefined,
			fields.summary,
			fields.documentLinks.length > 0 ? `${fields.documentLinks.length} linked source document(s) found.` : undefined,
		].filter(Boolean).join(" "),
		submissionMethod: submissionEmail
			? `Use the Africa CDC opportunity notice instructions; submission/contact email: ${submissionEmail}.`
			: "Use the Africa CDC opportunity notice for submission instructions.",
		tags: ["africa-cdc", "african-union", "africa", "health-procurement"],
		metadata: {
			africaCdc: {
				sourceUrl,
				deadlineText: fields.deadlineText,
				reference,
				bidType: fields.bidType,
				submissionEmail,
				documentLinks: fields.documentLinks,
			},
		},
	};
}

export function parseAfricaCdcOpportunitiesHtml(
	html: string,
	sourceUrl = AFRICA_CDC_OPPORTUNITIES_URL,
	now = new Date()
): AfricaCdcOpportunity[] {
	const opportunities: AfricaCdcOpportunity[] = [];
	const seen = new Set<string>();
	const rowPattern = /<div class=["']col-md-6["']>\s*<strong>\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*<\/strong>\s*<\/div>\s*<div class=["']col-md-2["']>([\s\S]*?)<\/div>\s*<div class=["']col-md-2["']>([\s\S]*?)<\/div>\s*<div class=["']col-md-2["']>([\s\S]*?)<\/div>/gi;
	for (const match of html.matchAll(rowPattern)) {
		const portalUrl = absoluteAfricaCdcUrl(attrValue(match[1], "href"), sourceUrl);
		const title = stripHtml(match[2]);
		if (!portalUrl || !title || seen.has(portalUrl)) continue;
		const deadlineText = stripHtml(match[3]) || undefined;
		const deadline = parseAfricaCdcDate(deadlineText);
		if (isExpired(deadline, now)) continue;
		seen.add(portalUrl);
		opportunities.push(opportunityFromFields({
			title,
			portalUrl,
			deadline,
			deadlineText,
			reference: stripHtml(match[4]) || undefined,
			bidType: stripHtml(match[5]) || undefined,
			documentLinks: [],
		}, sourceUrl));
	}
	return opportunities.length > 0 ? opportunities : parseAfricaCdcDetailHtml(html, sourceUrl, now);
}

export function parseAfricaCdcDetailHtml(
	html: string,
	sourceUrl: string,
	now = new Date()
): AfricaCdcOpportunity[] {
	const title = stripHtml(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]);
	if (!title) return [];
	const bidType = stripHtml(/<h5\b[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>([\s\S]*?)<\/h5>/i.exec(html)?.[1]) || undefined;
	const deadlineText = stripHtml(/>\s*Deadline\s*<\/h5>[\s\S]*?<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(html)?.[1])
		|| stripHtml(/Submission Deadline:\s*([^<\n]+)/i.exec(html)?.[1])
		|| undefined;
	const deadline = parseAfricaCdcDate(deadlineText);
	if (isExpired(deadline, now)) return [];
	const reference = stripHtml(/>\s*Bid Number\s*<\/h5>[\s\S]*?<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(html)?.[1])
		|| stripHtml(/\b(?:RFP No\.?|RFB No\.?|Bid Number):?\s*([^<\n]+)/i.exec(html)?.[1])
		|| undefined;
	const summary = stripHtml(/elementor-widget-theme-post-content[\s\S]*?<div class=["']elementor-widget-container["']>([\s\S]*?)<\/div>\s*<\/div>/i.exec(html)?.[1])
		.slice(0, 1200) || undefined;
	return [opportunityFromFields({
		title,
		portalUrl: sourceUrl,
		deadline,
		deadlineText,
		reference,
		bidType,
		summary,
		documentLinks: collectDocumentLinks(html, sourceUrl),
	}, sourceUrl)];
}

export function parseAfricaCdcOpportunitiesMarkdown(
	markdown: string,
	sourceUrl = AFRICA_CDC_OPPORTUNITIES_URL,
	now = new Date()
): AfricaCdcOpportunity[] {
	const opportunities: AfricaCdcOpportunity[] = [];
	const seen = new Set<string>();
	const rowPattern = /\*\*\[([^\]]+)\]\((https?:\/\/africacdc\.org\/opportunity\/[^)]+)\)\s*\*\*\s*\n+\s*([^\n]+)\s*\n+\s*([^\n]+)\s*\n+\s*([^\n]+)/g;
	for (const match of markdown.matchAll(rowPattern)) {
		const title = cleanText(match[1]);
		const portalUrl = absoluteAfricaCdcUrl(match[2], sourceUrl);
		if (!title || !portalUrl || seen.has(portalUrl)) continue;
		const deadlineText = cleanText(match[3]);
		const deadline = parseAfricaCdcDate(deadlineText);
		if (isExpired(deadline, now)) continue;
		seen.add(portalUrl);
		opportunities.push(opportunityFromFields({
			title,
			portalUrl,
			deadline,
			deadlineText,
			reference: cleanText(match[4]) || undefined,
			bidType: cleanText(match[5]) || undefined,
			documentLinks: [],
		}, sourceUrl));
	}
	if (opportunities.length > 0) return opportunities;

	const title = cleanText((/^(.+)\n=+/m.exec(markdown)?.[1] ?? "").replace(/^#+\s*/, ""));
	const deadlineText = /Submission Deadline:\s*([^\n]+)/i.exec(markdown)?.[1]?.trim()
		|| /##### Deadline\s+###\s*([^\n]+)/i.exec(markdown)?.[1]?.trim();
	if (!title || !deadlineText) return [];
	const deadline = parseAfricaCdcDate(deadlineText);
	if (isExpired(deadline, now)) return [];
	return [opportunityFromFields({
		title,
		portalUrl: sourceUrl,
		deadline,
		deadlineText,
		reference: /##### Bid Number\s+###\s*([^\n]+)/i.exec(markdown)?.[1]?.trim(),
		bidType: /^#####\s*([^\n]+)/m.exec(markdown)?.[1]?.trim(),
		summary: cleanText(markdown).slice(0, 1200) || undefined,
		documentLinks: collectDocumentLinks(markdown, sourceUrl),
	}, sourceUrl)];
}

export const africaCdcParser: TenderParser = {
	sourceId: "africa_cdc",
	name: "Africa CDC Supply Chain Opportunities",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		const htmlOpportunities = parseAfricaCdcOpportunitiesHtml(input.html ?? "", input.url);
		if (htmlOpportunities.length > 0) return { opportunities: htmlOpportunities };
		return { opportunities: parseAfricaCdcOpportunitiesMarkdown(input.markdown ?? "", input.url) };
	},

	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl || AFRICA_CDC_OPPORTUNITIES_URL;
		const url = new URL(baseUrl || AFRICA_CDC_OPPORTUNITIES_URL);
		url.searchParams.set("wpv_paged", String(page));
		url.hash = "";
		return url.toString();
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(africaCdcParser);
