/**
 * World Bank procurement notices parser.
 *
 * The procurement page renders as a markdown table. The generic parser only
 * sees a few tender-like titles, so parse table rows directly and skip awards.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

export interface WorldBankNoticeDetail {
	projectId?: string;
	projectTitle?: string;
	noticeNo?: string;
	noticeType?: string;
	borrowerBidReference?: string;
	procurementMethod?: string;
	language?: string;
	submissionDeadline?: Date;
	publishedDate?: Date;
	organization?: string;
	contactEmail?: string;
	details?: string;
}

const WORLD_BANK_BASE_URL = "https://projects.worldbank.org";
const WORLD_BANK_NOTICE_API_BASE_URL = "https://search.worldbank.org/api/procnotices";
const WORLD_BANK_NOTICE_LIST_API_BASE_URL = "https://search.worldbank.org/api/v2/procnotices";
const PROCUREMENT_DETAIL_PATTERN = /projects\.worldbank\.org\/en\/projects-operations\/procurement-detail\/(OP\d+)/i;
const PROJECT_LINK_PATTERN = /\[([^\]]+)]\((https?:\/\/projects\.worldbank\.org\/en\/projects-operations\/project-detail\/[^)]+)\)/i;
const DESCRIPTION_LINK_PATTERN = /\[([^\]]+)]\((https?:\/\/projects\.worldbank\.org\/en\/projects-operations\/procurement-detail\/[^)]+)\)/i;

type WorldBankApiRecord = Record<string, unknown>;

function normalizeWorldBankUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.protocol = "https:";
		return parsed.toString();
	} catch {
		return url;
	}
}

function sourceIdFromUrl(url: string): string {
	const match = url.match(PROCUREMENT_DETAIL_PATTERN);
	return match?.[1] ?? url
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

export function worldBankNoticeIdFromUrl(url: string | undefined): string | undefined {
	return url?.match(PROCUREMENT_DETAIL_PATTERN)?.[1];
}

function splitMarkdownRow(line: string): string[] {
	return line
		.replace(/^\s*\|\s*/, "")
		.replace(/\s*\|\s*$/, "")
		.split(/\s*\|\s*/)
		.map(cleanText);
}

function isDataRow(cells: string[]): boolean {
	if (cells.length < 6) return false;
	if (!DESCRIPTION_LINK_PATTERN.test(cells[0])) return false;
	const noticeType = cells[3]?.toLowerCase() ?? "";
	return !noticeType.includes("award");
}

function inferOpportunityType(noticeType: string): OpportunityData["opportunityType"] {
	const normalized = noticeType.toLowerCase();
	if (normalized.includes("expression of interest")) return "eoi";
	if (normalized.includes("proposal")) return "rfp";
	return "tender";
}

function parseWorldBankMarkdown(markdown: string | undefined): OpportunityData[] {
	if (!markdown) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const line of markdown.split(/\r?\n/)) {
		const cells = splitMarkdownRow(line);
		if (!isDataRow(cells)) continue;

		const descriptionMatch = cells[0].match(DESCRIPTION_LINK_PATTERN);
		if (!descriptionMatch) continue;
		const title = cleanText(descriptionMatch[1]);
		const portalUrl = normalizeWorldBankUrl(descriptionMatch[2]);
		if (!title || seen.has(portalUrl)) continue;
		seen.add(portalUrl);

		const projectMatch = cells[2]?.match(PROJECT_LINK_PATTERN);
		const noticeType = cleanText(cells[3]);
		const language = cleanText(cells[4]);
		const publishedDate = parseDate(cells[5]);
		const sourceId = sourceIdFromUrl(portalUrl);

		opportunities.push({
			title,
			source: "world_bank",
			sourceId,
			noticeId: sourceId,
			organization: "World Bank",
			countryRegion: cleanText(cells[1]) || undefined,
			category: noticeType || "Procurement notice",
			opportunityType: inferOpportunityType(noticeType),
			publishedDate,
			portalUrl,
			documentUrl: portalUrl,
			rfpLink: portalUrl,
			projectSummary: projectMatch?.[1] ? `Project: ${cleanText(projectMatch[1])}` : undefined,
			funder: "World Bank",
			tags: ["world-bank", "development-bank", "global-procurement"],
			metadata: {
				worldBank: {
					projectTitle: projectMatch?.[1] ? cleanText(projectMatch[1]) : null,
					projectUrl: projectMatch?.[2] ? normalizeWorldBankUrl(projectMatch[2]) : null,
					noticeType,
					language,
					publishedDate: publishedDate?.toISOString() ?? null,
				},
			},
		});
	}

	return opportunities;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractField(markdown: string, label: string): string | undefined {
	const pattern = new RegExp(`\\*\\s+${escapeRegExp(label)}\\s*\\n+\\s*([^\\n]+)`, "i");
	const match = markdown.match(pattern);
	const value = cleanText(match?.[1]?.replace(/\[([^\]]+)]\([^)]+\)/g, "$1"));
	return value || undefined;
}

function cleanMarkdownProse(value: string | undefined): string | undefined {
	const cleaned = cleanText(value
		?.replace(/!\[[^\]]*]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
		.replace(/[*_`>#-]+/g, " ")
		.replace(/\s+/g, " "));
	return cleaned || undefined;
}

function extractDetailsSection(markdown: string): string | undefined {
	const match = markdown.match(/Details\s*\n[-=]+\s*\n([\s\S]*?)(?=\nFeedback Survey\b|\n[A-Z][^\n]{0,80}\n[-=]{3,}|$)/i);
	return cleanMarkdownProse(match?.[1]);
}

function stringField(record: WorldBankApiRecord, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.trim() ? cleanText(value) : undefined;
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
		lsquo: "'",
		rsquo: "'",
		ldquo: "\"",
		rdquo: "\"",
		Aacute: "A",
		aacute: "a",
		Acirc: "A",
		acirc: "a",
		Agrave: "A",
		agrave: "a",
		Atilde: "A",
		atilde: "a",
		Ccedil: "C",
		ccedil: "c",
		Eacute: "E",
		eacute: "e",
		Ecirc: "E",
		ecirc: "e",
		Iacute: "I",
		iacute: "i",
		Oacute: "O",
		oacute: "o",
		Ocirc: "O",
		ocirc: "o",
		Otilde: "O",
		otilde: "o",
		Uacute: "U",
		uacute: "u",
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

function htmlToText(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const text = decodeHtmlEntities(value
		.replace(/<\s*br\s*\/?>/gi, "\n")
		.replace(/<\s*\/p\s*>/gi, "\n")
		.replace(/<[^>]+>/g, " "));
	return cleanText(text) || undefined;
}

function parseWorldBankApiDeadline(record: WorldBankApiRecord): Date | undefined {
	const date = stringField(record, "submission_deadline_date");
	const time = stringField(record, "submission_deadline_time");
	const datePart = date?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
	if (datePart && time) {
		const parsed = Date.parse(`${datePart} ${time}`);
		if (!Number.isNaN(parsed)) return new Date(parsed);
	}
	return parseDate(date);
}

function worldBankProcurementDetailUrl(noticeId: string): string {
	return `${WORLD_BANK_BASE_URL}/en/projects-operations/procurement-detail/${noticeId}`;
}

function worldBankProjectDetailUrl(projectId: string | undefined): string | undefined {
	return projectId ? `${WORLD_BANK_BASE_URL}/en/projects-operations/project-detail/${projectId}` : undefined;
}

export function parseWorldBankNoticeListApiResponse(value: unknown): OpportunityData[] {
	if (!value || typeof value !== "object") return [];
	const procnotices = (value as { procnotices?: unknown }).procnotices;
	if (!Array.isArray(procnotices)) return [];
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();

	for (const item of procnotices) {
		if (!item || typeof item !== "object") continue;
		const record = item as WorldBankApiRecord;
		const noticeId = stringField(record, "id");
		const noticeType = stringField(record, "notice_type") ?? "Procurement notice";
		const noticeStatus = stringField(record, "notice_status");
		if (!noticeId || seen.has(noticeId) || /\baward\b/iu.test(noticeType)) continue;
		seen.add(noticeId);

		const title = stringField(record, "bid_description") ?? stringField(record, "project_name");
		if (!title) continue;
		const projectId = stringField(record, "project_id");
		const projectTitle = stringField(record, "project_name");
		const language = stringField(record, "notice_lang_name");
		const publishedDate = parseDate(stringField(record, "noticedate"));
		const portalUrl = worldBankProcurementDetailUrl(noticeId);
		const projectUrl = worldBankProjectDetailUrl(projectId);

		opportunities.push({
			title,
			source: "world_bank",
			sourceId: noticeId,
			noticeId,
			organization: "World Bank",
			countryRegion: stringField(record, "project_ctry_name"),
			category: noticeType,
			opportunityType: inferOpportunityType(noticeType),
			publishedDate,
			portalUrl,
			documentUrl: portalUrl,
			rfpLink: portalUrl,
			projectSummary: projectTitle ? `Project: ${projectTitle}` : undefined,
			funder: "World Bank",
			tags: ["world-bank", "development-bank", "global-procurement", "api-list"],
			metadata: {
				worldBank: {
					projectTitle: projectTitle ?? null,
					projectUrl: projectUrl ?? null,
					noticeType,
					noticeStatus: noticeStatus ?? null,
					language: language ?? null,
					publishedDate: publishedDate?.toISOString() ?? null,
					discoveryMethod: "procnotices-api-v2",
				},
			},
		});
	}

	return opportunities;
}

export function parseWorldBankNoticeDetailApiResponse(value: unknown): WorldBankNoticeDetail {
	if (!value || typeof value !== "object") return {};
	const procnotices = (value as { procnotices?: unknown }).procnotices;
	if (!Array.isArray(procnotices) || !procnotices[0] || typeof procnotices[0] !== "object") return {};
	const record = procnotices[0] as WorldBankApiRecord;
	const noticeText = htmlToText(stringField(record, "notice_text"));
	return {
		projectId: stringField(record, "project_id"),
		projectTitle: stringField(record, "project_name"),
		noticeNo: stringField(record, "id"),
		noticeType: stringField(record, "notice_type"),
		borrowerBidReference: stringField(record, "bid_reference_no"),
		procurementMethod: stringField(record, "procurement_method_name"),
		language: stringField(record, "notice_lang_name"),
		submissionDeadline: parseWorldBankApiDeadline(record),
		publishedDate: parseDate(stringField(record, "noticedate")),
		organization: stringField(record, "contact_organization"),
		contactEmail: stringField(record, "contact_email"),
		details: noticeText,
	};
}

export function worldBankNoticeApiUrl(noticeId: string): string {
	const url = new URL(WORLD_BANK_NOTICE_API_BASE_URL);
	url.searchParams.set("format", "json");
	url.searchParams.set("apilang", "en");
	url.searchParams.set("id", noticeId);
	return url.toString();
}

export function worldBankNoticeListApiUrl(rows = 20, offset = 0): string {
	const url = new URL(WORLD_BANK_NOTICE_LIST_API_BASE_URL);
	url.searchParams.set("format", "json");
	url.searchParams.set("fct", [
		"procurement_group_desc_exact",
		"notice_type_exact",
		"procurement_method_code_exact",
		"procurement_method_name_exact",
		"project_ctry_code_exact",
		"project_ctry_name_exact",
		"regionname_exact",
		"rregioncode",
		"project_id",
		"sector_exact",
		"sectorcode_exact",
	].join(","));
	url.searchParams.set("fl", [
		"id",
		"bid_description",
		"project_ctry_name",
		"project_id",
		"project_name",
		"notice_type",
		"notice_status",
		"notice_lang_name",
		"submission_date",
		"noticedate",
	].join(","));
	url.searchParams.set("srt", "submission_date desc,id asc");
	url.searchParams.set("apilang", "en");
	url.searchParams.set("rows", String(rows));
	url.searchParams.set("os", String(offset));
	return url.toString();
}

export async function fetchWorldBankNoticeDetail(noticeId: string): Promise<WorldBankNoticeDetail> {
	const response = await fetch(worldBankNoticeApiUrl(noticeId), {
		headers: {
			"Accept": "application/json",
		},
	});
	if (!response.ok) {
		throw new Error(`World Bank notice API returned ${response.status}`);
	}
	return parseWorldBankNoticeDetailApiResponse(await response.json());
}

export async function fetchWorldBankNoticeList(rows = 20, offset = 0): Promise<OpportunityData[]> {
	const response = await fetch(worldBankNoticeListApiUrl(rows, offset), {
		headers: {
			"Accept": "application/json",
		},
	});
	if (!response.ok) {
		throw new Error(`World Bank notice list API returned ${response.status}`);
	}
	return parseWorldBankNoticeListApiResponse(await response.json());
}

export function parseWorldBankNoticeDetailMarkdown(markdown: string | undefined): WorldBankNoticeDetail {
	if (!markdown) return {};
	const contactEmail = markdown.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
	return {
		projectId: extractField(markdown, "Project ID"),
		projectTitle: extractField(markdown, "Project Title"),
		noticeNo: extractField(markdown, "Notice No"),
		noticeType: extractField(markdown, "Notice Type"),
		borrowerBidReference: extractField(markdown, "Borrower Bid Reference"),
		procurementMethod: extractField(markdown, "Procurement Method"),
		language: extractField(markdown, "Language of Notice"),
		submissionDeadline: parseDate(extractField(markdown, "Submission Deadline Date/Time")),
		publishedDate: parseDate(extractField(markdown, "Published Date")),
		organization: extractField(markdown, "Organization/Department"),
		contactEmail,
		details: extractDetailsSection(markdown),
	};
}

export const worldBankParser: TenderParser = {
	sourceId: "world_bank",
	name: "World Bank Procurement Notices",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		if (!content.markdown?.trim() && !content.html?.trim()) {
			try {
				return {
					opportunities: await fetchWorldBankNoticeList(50),
				};
			} catch (error) {
				return {
					opportunities: [],
					error: error instanceof Error ? error.message : "World Bank notice list API failed",
				};
			}
		}

		return {
			opportunities: parseWorldBankMarkdown(content.markdown),
		};
	},
	getPageUrl(baseUrl: string, page: number): string {
		if (page <= 1) return baseUrl;
		const url = new URL(baseUrl, WORLD_BANK_BASE_URL);
		url.searchParams.set("page", String(page));
		return url.toString();
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(worldBankParser);

export default worldBankParser;
