/**
 * UNICEF Supply Division tender calendar parser.
 *
 * UNICEF publishes some procurement demand as calendar rows instead of dated
 * notices. Keep those as early opportunity leads and preserve the issuance
 * window as metadata rather than fabricating exact deadlines.
 */

import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const UNICEF_BASE_URL = "https://www.unicef.org";
const SERVICE_CONTRACTS_PATH = "/supply/service-contracts-tender-calendar";
const TENDER_CALENDARS_PATH = "/supply/tender-calendars";
const DEFAULT_CONTACT_EMAIL = "sd.servicecontracting@unicef.org";
const TABLE_SEPARATOR_PATTERN = /^:?-{3,}:?$/;
const DOCUMENT_LINK_PATTERN = /\[([^\]]+)]\((https?:\/\/www\.unicef\.org\/supply\/media\/[^)]+\.(?:pdf|xlsx?|docx?)[^)]*)\)/gi;
const CARD_HEADING_PATTERN = /###\s+\[([^\]]+)]\((https?:\/\/www\.unicef\.org\/supply\/[^)]+)\)([\s\S]*?)(?=\n###\s+\[|$)/gi;

function sourceIdFromTitle(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 90);
	return `unicef-${slug || "tender-calendar"}`;
}

function pageKind(url: string): "service-contracts" | "tender-calendars" | "supply" {
	try {
		const pathname = new URL(url, UNICEF_BASE_URL).pathname;
		if (pathname === SERVICE_CONTRACTS_PATH) return "service-contracts";
		if (pathname === TENDER_CALENDARS_PATH) return "tender-calendars";
	} catch {
		// Fall through to broad supply metadata.
	}
	return "supply";
}

function splitMarkdownTableRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\||\|$/g, "")
		.split("|")
		.map((cell) => cleanText(cell.replace(/\\\|/g, "|")));
}

function isSeparatorRow(cells: string[]): boolean {
	return cells.length > 0 && cells.every((cell) => TABLE_SEPARATOR_PATTERN.test(cell.trim()));
}

function contactEmail(markdown: string): string {
	return markdown.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? DEFAULT_CONTACT_EMAIL;
}

function inferCountryRegion(title: string): string {
	return /\beast africa\b/i.test(title) ? "East Africa" : "Global";
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const normalized = title.toLowerCase();
	if (normalized.includes("request for proposal") || /\brfp\b/.test(normalized)) return "rfp";
	if (normalized.includes("invitation to bid") || /\bitb\b/.test(normalized)) return "tender";
	if (normalized.includes("tender")) return "tender";
	return "eoi";
}

function inferTags(title: string, baseTags: string[] = []): string[] {
	const normalized = title.toLowerCase();
	const tags = new Set(["unicef", "un-procurement", "tender-calendar", ...baseTags]);
	if (/\b(ict|telephony|software|satellite|mobile|hardware)\b/i.test(normalized)) tags.add("ict");
	if (/\b(energy|solar|water|sanitation|hygiene)\b/i.test(normalized)) tags.add("wash-energy");
	if (/\b(education|medical|medicines?|nutrition|vaccine)\b/i.test(normalized)) tags.add("health-education");
	return [...tags];
}

function buildServiceSummary(title: string, duration: string | undefined, issuance: string | undefined): string {
	return [
		"UNICEF Supply Division service contract tender calendar entry.",
		duration ? `Estimated duration: ${duration}.` : undefined,
		issuance ? `Estimated tender issuance: ${issuance}.` : undefined,
		`Prospective suppliers should express interest with UNICEF Supply Division and maintain UNGM registration for the tender process.`,
	].filter(Boolean).join(" ");
}

function parseServiceContractRows(markdown: string, sourceUrl: string): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const lines = markdown.split(/\r?\n/);
	let tableStart = -1;
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (
			line.includes("|")
			&& /description of tender/i.test(line)
			&& /estimated duration/i.test(line)
			&& /estimated time/i.test(line)
		) {
			tableStart = index;
			break;
		}
	}
	if (tableStart < 0) return opportunities;

	const headers = splitMarkdownTableRow(lines[tableStart]);
	const descriptionIndex = headers.findIndex((header) => /description of tender/i.test(header));
	const durationIndex = headers.findIndex((header) => /estimated duration/i.test(header));
	const issuanceIndex = headers.findIndex((header) => /estimated time/i.test(header));
	if (descriptionIndex < 0) return opportunities;

	const email = contactEmail(markdown);
	for (const line of lines.slice(tableStart + 1)) {
		if (!line.trim()) {
			if (opportunities.length > 0) break;
			continue;
		}
		if (!line.includes("|")) {
			if (opportunities.length > 0) break;
			continue;
		}
		const cells = splitMarkdownTableRow(line);
		if (isSeparatorRow(cells)) continue;

		const title = cleanText(cells[descriptionIndex]);
		if (!title || /^description of tender$/i.test(title)) continue;
		const estimatedDuration = cleanText(cells[durationIndex]) || undefined;
		const estimatedIssuance = cleanText(cells[issuanceIndex]) || undefined;
		const sourceId = sourceIdFromTitle(title);

		opportunities.push({
			title,
			source: "unicef",
			sourceId,
			noticeId: sourceId,
			organization: "UNICEF Supply Division",
			countryRegion: inferCountryRegion(title),
			category: "Service contract tender calendar",
			opportunityType: inferOpportunityType(title),
			portalUrl: sourceUrl,
			rfpLink: sourceUrl,
			projectSummary: buildServiceSummary(title, estimatedDuration, estimatedIssuance),
			submissionMethod: `Express interest by emailing ${email}; suppliers should also be registered on UNGM.`,
			tags: inferTags(title, ["service-contract"]),
			metadata: {
				unicef: {
					sourcePage: "service-contracts-tender-calendar",
					estimatedDuration: estimatedDuration ?? null,
					estimatedIssuance: estimatedIssuance ?? null,
					contactEmail: email,
				},
			},
		});
	}

	return opportunities;
}

function firstDocumentLink(markdown: string): { label: string; url: string } | undefined {
	for (const match of markdown.matchAll(DOCUMENT_LINK_PATTERN)) {
		const label = cleanText(match[1]);
		const url = match[2]?.trim();
		if (url) return { label, url };
	}
	return undefined;
}

function cleanCardSummary(markdown: string): string | undefined {
	const withoutLinks = markdown
		.replace(DOCUMENT_LINK_PATTERN, "")
		.replace(/Files available for download\s*\(\d+\)/gi, "")
		.replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
		.replace(/#+\s*/g, "");
	const summary = cleanText(withoutLinks);
	return summary || undefined;
}

function parseTenderCalendarCards(markdown: string, sourceUrl: string): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	for (const match of markdown.matchAll(CARD_HEADING_PATTERN)) {
		const title = cleanText(match[1]);
		if (!title) continue;
		const portalUrl = match[2];
		const body = match[3] ?? "";
		const document = firstDocumentLink(body);
		const sourceId = sourceIdFromTitle(title);
		const summary = cleanCardSummary(body) ?? "UNICEF Supply Division tender calendar document.";

		opportunities.push({
			title,
			source: "unicef",
			sourceId,
			noticeId: sourceId,
			organization: "UNICEF Supply Division",
			countryRegion: "Global",
			category: "UNICEF tender calendar",
			opportunityType: "eoi",
			portalUrl: portalUrl || sourceUrl,
			documentUrl: document?.url,
			rfpLink: document?.url ?? portalUrl ?? sourceUrl,
			projectSummary: summary,
			submissionMethod: document
				? `Review the ${document.label || "UNICEF tender calendar"} and monitor UNICEF Supply Division/UNGM tender notices.`
				: "Monitor UNICEF Supply Division and UNGM tender notices.",
			tags: inferTags(title, ["supply"]),
			metadata: {
				unicef: {
					sourcePage: "tender-calendars",
					documentLabel: document?.label ?? null,
					sourceUrl,
				},
			},
		});
	}
	return opportunities;
}

function parseUnicefMarkdown(markdown: string | undefined, sourceUrl: string): OpportunityData[] {
	if (!markdown) return [];
	const kind = pageKind(sourceUrl);
	const opportunities = kind === "service-contracts"
		? parseServiceContractRows(markdown, sourceUrl)
		: kind === "tender-calendars"
			? parseTenderCalendarCards(markdown, sourceUrl)
			: [
				...parseServiceContractRows(markdown, sourceUrl),
				...parseTenderCalendarCards(markdown, sourceUrl),
			];

	const seen = new Set<string>();
	return opportunities.filter((opportunity) => {
		const key = opportunity.sourceId ?? opportunity.title;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export const unicefParser: TenderParser = {
	sourceId: "unicef",
	name: "UNICEF Supply Division",
	requiresJavascript: false,
	async parse(content: ParseInput): Promise<ParseResult> {
		return {
			opportunities: parseUnicefMarkdown(content.markdown, content.url),
		};
	},
	getPageUrl(baseUrl: string): string {
		return baseUrl;
	},
	hasNextPage(): boolean {
		return false;
	},
};

registerParser(unicefParser);

export default unicefParser;
