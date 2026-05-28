/**
 * AIIB project procurement opportunity parser.
 *
 * The visible list page is rendered from ppo-data-all.js. Reading that data
 * file directly gives stable project procurement rows without browser fallback.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

const AIIB_BASE_URL = "https://www.aiib.org";
const AIIB_PROJECT_PROCUREMENT_DATA_PATH = "/en/opportunities/business/project-procurement/_common/ppo-data-all.js";
const DATA_SCRIPT_PATTERN = /<script\b[^>]*\bsrc=["']([^"']*ppo-data-all\.js[^"']*)["'][^>]*>/i;
const DATA_ARRAY_PATTERN = /var\s+ppoData\s*=\s*\[([\s\S]*?)\]\s*;?/i;
const DATA_OBJECT_PATTERN = /\{[^{}]*\}/g;
const DATA_FIELD_PATTERN = /([a-z]{2}):"((?:\\.|[^"\\])*)"/gi;
const RECENT_NO_DEADLINE_DAYS = 90;

interface AiibProjectProcurementRow {
	id?: string;
	cd?: string;
	mb?: string;
	pj?: string;
	ds?: string;
	cr?: string;
	sd?: string;
	pc?: string;
	st?: string;
	ct?: string;
	tp?: string;
	dc?: string;
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
		rsquo: "'",
		lsquo: "'",
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
		return namedEntities[name.toLowerCase()] ?? entity;
	});
}

function cleanField(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeHtmlEntities(value
		.replace(/\\"/g, "\"")
		.replace(/\\'/g, "'")
		.replace(/\\\\/g, "\\")));
}

function resolveAiibUrl(href: string | undefined): string | undefined {
	if (!href) return undefined;
	try {
		return new URL(href, AIIB_BASE_URL).toString();
	} catch {
		return undefined;
	}
}

function extractDataScriptUrl(html: string | undefined): string {
	const src = html?.match(DATA_SCRIPT_PATTERN)?.[1];
	return resolveAiibUrl(src) ?? new URL(AIIB_PROJECT_PROCUREMENT_DATA_PATH, AIIB_BASE_URL).toString();
}

function parseAiibRows(dataScript: string): AiibProjectProcurementRow[] {
	const dataBody = dataScript.match(DATA_ARRAY_PATTERN)?.[1];
	if (!dataBody) return [];

	return [...dataBody.matchAll(DATA_OBJECT_PATTERN)]
		.map((objectMatch) => {
			const row: AiibProjectProcurementRow = {};
			for (const fieldMatch of objectMatch[0].matchAll(DATA_FIELD_PATTERN)) {
				const key = fieldMatch[1] as keyof AiibProjectProcurementRow;
				row[key] = cleanField(fieldMatch[2]);
			}
			return row;
		});
}

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function subtractDays(date: Date, days: number): Date {
	const copy = startOfDay(date);
	copy.setDate(copy.getDate() - days);
	return copy;
}

function isCurrentProcurementRow(row: AiibProjectProcurementRow, now: Date): boolean {
	const title = cleanField(row.pj);
	if (!title) return false;
	if (/contract awards?/i.test(`${row.ct} ${row.tp}`)) return false;

	const deadline = parseDate(row.cd);
	if (deadline) return startOfDay(deadline) >= startOfDay(now);

	const publishedDate = parseDate(row.id);
	if (!publishedDate) return false;
	return startOfDay(publishedDate) >= subtractDays(now, RECENT_NO_DEADLINE_DAYS);
}

function sourceIdFrom(row: AiibProjectProcurementRow, documentUrl: string | undefined): string {
	const documentName = documentUrl
		?.split("/")
		.pop()
		?.replace(/\.[a-z0-9]+(?:[?#].*)?$/i, "");
	const slugSource = documentName || `${row.id ?? ""} ${row.mb ?? ""} ${row.pj ?? ""}`;
	const slug = slugSource
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 45)
		.replace(/-+$/g, "");
	return `aiib-${slug || "project-procurement"}`;
}

function inferOpportunityType(row: AiibProjectProcurementRow): OpportunityData["opportunityType"] {
	const haystack = `${row.tp ?? ""} ${row.ct ?? ""} ${row.pj ?? ""}`.toLowerCase();
	if (haystack.includes("expression of interest") || /\beoi\b/.test(haystack)) return "eoi";
	if (haystack.includes("request for proposal") || /\brfp\b/.test(haystack)) return "rfp";
	return "tender";
}

function parseAiibProjectProcurementData(dataScript: string, sourceUrl: string, now = new Date()): OpportunityData[] {
	const rows = parseAiibRows(dataScript);
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const row of rows) {
		if (!isCurrentProcurementRow(row, now)) continue;

		const documentUrl = resolveAiibUrl(row.dc);
		const sourceId = sourceIdFrom(row, documentUrl);
		if (seen.has(sourceId)) continue;
		seen.add(sourceId);

		const title = cleanField(row.pj);
		const noticeType = cleanField(row.tp);
		const category = cleanField(row.ct);
		const sector = cleanField(row.st);
		const publishedText = cleanField(row.id);
		const closingText = cleanField(row.cd);
		const description = cleanField(row.ds);

		opportunities.push({
			title,
			source: "aiib",
			sourceId,
			noticeId: sourceId,
			organization: "Asian Infrastructure Investment Bank",
			countryRegion: cleanField(row.mb) || "Global",
			category: noticeType || category || "AIIB project procurement notice",
			opportunityType: inferOpportunityType(row),
			deadline: parseDate(closingText),
			publishedDate: parseDate(publishedText),
			portalUrl: sourceUrl,
			documentUrl,
			rfpLink: documentUrl ?? sourceUrl,
			projectSummary: [
				"AIIB project procurement opportunity.",
				description || undefined,
				noticeType ? `Type: ${noticeType}.` : undefined,
				sector ? `Sector: ${sector}.` : undefined,
				publishedText ? `Issue date: ${publishedText}.` : undefined,
				closingText ? `Closing date: ${closingText}.` : undefined,
			].filter(Boolean).join(" "),
			funder: "Asian Infrastructure Investment Bank",
			sector: sector || undefined,
			tags: ["aiib", "development-bank", "project-procurement", "source-scrape"],
			metadata: {
				aiib: {
					sourcePage: sourceUrl,
					issueDate: publishedText || null,
					closingDate: closingText || null,
					member: cleanField(row.mb) || null,
					category: category || null,
					type: noticeType || null,
					sector: sector || null,
					documentUrl: documentUrl ?? null,
				},
			},
		});
	}

	return opportunities;
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, {
		headers: {
			accept: "text/html,application/xhtml+xml,application/javascript,text/javascript",
			"user-agent": "Mozilla/5.0 Lindela opportunity discovery",
		},
	});
	if (!response.ok) {
		throw new Error(`AIIB project procurement source returned HTTP ${response.status}`);
	}
	return await response.text();
}

async function fetchAiibDataScript(sourceUrl: string, html?: string): Promise<string> {
	const pageHtml = html?.includes("ppo-data-all.js") ? html : await fetchText(sourceUrl);
	const dataScriptUrl = extractDataScriptUrl(pageHtml);
	return await fetchText(dataScriptUrl);
}

export const aiibParser: TenderParser = {
	sourceId: "aiib",
	name: "AIIB Project Procurement Opportunities",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		const inlineData = (input.html ?? input.markdown ?? "").includes("var ppoData")
			? input.html ?? input.markdown ?? ""
			: undefined;
		if (inlineData) {
			return {
				opportunities: parseAiibProjectProcurementData(inlineData, input.url),
			};
		}

		try {
			const dataScript = await fetchAiibDataScript(input.url, input.html);
			return {
				opportunities: parseAiibProjectProcurementData(dataScript, input.url),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch AIIB project procurement data",
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

registerParser(aiibParser);
