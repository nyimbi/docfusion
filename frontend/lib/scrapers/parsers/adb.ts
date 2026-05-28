/**
 * ADB institutional procurement notices parser.
 *
 * The public project tender listing can be blocked by Cloudflare from server
 * runtimes, while the institutional procurement notices page is static HTML
 * with current RFP/RFQ/bid rows and direct document links.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const ADB_BASE_URL = "https://www.adb.org";
const PROCUREMENT_ROW_PATTERN = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const SECTION_PATTERN = /<h2\b[^>]*>([\s\S]*?)<\/h2>\s*<table\b[^>]*>([\s\S]*?)<\/table>/gi;
const TITLE_CELL_PATTERN = /<td\b[^>]*data-th=["']Title["'][^>]*>([\s\S]*?)<\/td>/i;
const START_CELL_PATTERN = /<td\b[^>]*data-th=["']Start date["'][^>]*>([\s\S]*?)<\/td>/i;
const END_CELL_PATTERN = /<td\b[^>]*data-th=["']End date["'][^>]*>([\s\S]*?)<\/td>/i;
const LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const DOCUMENT_EXTENSION_PATTERN = /\.(?:pdf|docx?|xlsx?|zip)(?:[?#].*)?$/i;

interface AdbLink {
	label?: string;
	url: string;
}

function decodeHtmlEntities(value: string): string {
	const namedEntities: Record<string, string> = {
		amp: "&",
		lt: "<",
		gt: ">",
		quot: "\"",
		apos: "'",
		nbsp: " ",
		ndash: "-",
		mdash: "-",
	};
	return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (entity, name: string) => {
		if (name.startsWith("#x")) {
			const codePoint = Number.parseInt(name.slice(2), 16);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
		}
		if (name.startsWith("#")) {
			const codePoint = Number.parseInt(name.slice(1), 10);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
		}
		return namedEntities[name] ?? entity;
	});
}

function htmlToText(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeHtmlEntities(value
		.replace(/<\s*br\s*\/?>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function resolveAdbUrl(href: string): string | undefined {
	try {
		return new URL(href, ADB_BASE_URL).toString();
	} catch {
		return undefined;
	}
}

function extractLinks(cellHtml: string): AdbLink[] {
	return [...cellHtml.matchAll(LINK_PATTERN)]
		.flatMap((match) => {
			const url = resolveAdbUrl(match[1]);
			if (!url) return [];
			const label = htmlToText(match[2]) || undefined;
			return label ? [{ url, label }] : [{ url }];
		});
}

function sourceIdFrom(title: string, documentUrl?: string): string {
	const documentName = documentUrl
		?.split("/")
		.pop()
		?.replace(/\.[a-z0-9]+(?:[?#].*)?$/i, "");
	const slugSource = documentName || title;
	const slug = slugSource
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return `adb-${slug || "institutional-notice"}`;
}

function inferOpportunityType(section: string, title: string): OpportunityData["opportunityType"] {
	const normalized = `${section} ${title}`.toLowerCase();
	if (normalized.includes("expression of interest") || /\beoi\b/.test(normalized)) return "eoi";
	if (normalized.includes("request for proposal") || /\brfp\b/.test(normalized)) return "rfp";
	return "tender";
}

function parseAdbInstitutionalHtml(html: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!html) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const sectionMatch of html.matchAll(SECTION_PATTERN)) {
		const section = htmlToText(sectionMatch[1]);
		if (!/\b(?:request|invitation|expression|quotation|proposal|bid)\b/i.test(section)) continue;
		const tableHtml = sectionMatch[2];

		for (const rowMatch of tableHtml.matchAll(PROCUREMENT_ROW_PATTERN)) {
			const rowHtml = rowMatch[1];
			const titleCell = rowHtml.match(TITLE_CELL_PATTERN)?.[1];
			const titleLinks = titleCell ? extractLinks(titleCell) : [];
			const title = cleanText(titleLinks[0]?.label || htmlToText(titleCell));
			if (!title) continue;

			const allDocumentLinks = titleLinks.filter((link) => DOCUMENT_EXTENSION_PATTERN.test(new URL(link.url).pathname));
			const primaryDocument = allDocumentLinks[0]?.url;
			const sourceId = sourceIdFrom(title, primaryDocument);
			if (seen.has(sourceId)) continue;
			seen.add(sourceId);

			const startDateText = htmlToText(rowHtml.match(START_CELL_PATTERN)?.[1]);
			const endDateText = htmlToText(rowHtml.match(END_CELL_PATTERN)?.[1]);
			const deadline = parseDate(endDateText);
			const publishedDate = parseDate(startDateText);

			opportunities.push({
				title,
				source: "adb",
				sourceId,
				noticeId: sourceId,
				organization: "Asian Development Bank",
				countryRegion: "Global",
				category: section || "ADB institutional procurement notice",
				opportunityType: inferOpportunityType(section, title),
				deadline,
				publishedDate,
				portalUrl: sourceUrl,
				documentUrl: primaryDocument,
				rfpLink: primaryDocument ?? sourceUrl,
				projectSummary: [
					"ADB institutional procurement notice.",
					section ? `Category: ${section}.` : undefined,
					startDateText ? `Start date: ${startDateText}.` : undefined,
					endDateText ? `End date: ${endDateText}.` : undefined,
				].filter(Boolean).join(" "),
				funder: "Asian Development Bank",
				tags: ["adb", "development-bank", "institutional-procurement", "source-scrape"],
				metadata: {
					adb: {
						sourcePage: sourceUrl,
						category: section,
						startDate: startDateText || null,
						endDate: endDateText || null,
						documentLinks: allDocumentLinks,
					},
				},
			});
		}
	}

	return opportunities;
}

async function fetchAdbInstitutionalPage(sourceUrl: string): Promise<string> {
	const response = await fetch(sourceUrl, {
		headers: {
			accept: "text/html,application/xhtml+xml",
			"user-agent": "Mozilla/5.0 Lindela opportunity discovery",
		},
	});
	if (!response.ok) {
		throw new Error(`ADB institutional procurement page returned HTTP ${response.status}`);
	}
	return await response.text();
}

export const adbParser: TenderParser = {
	sourceId: "adb",
	name: "ADB Institutional Procurement Notices",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		const scrapedOpportunities = parseAdbInstitutionalHtml(input.html ?? input.markdown, input.url);
		if (scrapedOpportunities.length > 0) {
			return { opportunities: scrapedOpportunities };
		}

		try {
			const html = await fetchAdbInstitutionalPage(input.url);
			return {
				opportunities: parseAdbInstitutionalHtml(html, input.url),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch ADB institutional procurement notices",
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(adbParser);
