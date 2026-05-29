import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const UMUCYO_BASE_URL = "https://www.umucyo.gov.rw";
export const UMUCYO_ADVERTISING_URL =
	`${UMUCYO_BASE_URL}/eb/bav/selectListAdvertisingListForGU.do?menuId=EB01020100&leftTopFlag=l&recordCountPerPage=50`;

type UmucyoRadioFields = {
	internalReference: string;
	title: string;
	procuringEntityCode: string;
	deadline: string;
	stageCode: string;
	methodCode: string;
	typeCode: string;
	openingAt: string;
	publishedFlag: string;
};

function decodeEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function stripHtml(value: string): string {
	return cleanText(decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")));
}

function cellHtml(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1] ?? "");
}

function radioValue(rowHtml: string): string | undefined {
	return /<input\b[^>]*name=["']tenderNo["'][^>]*value=["']([^"']+)["']/i.exec(rowHtml)?.[1];
}

function parseRadioFields(rawValue: string): UmucyoRadioFields | undefined {
	const parts = decodeEntities(rawValue).split("|").map((part) => cleanText(part));
	if (parts.length < 9 || !parts[0] || !parts[1]) return undefined;
	return {
		internalReference: parts[0],
		title: parts[1],
		procuringEntityCode: parts[2],
		deadline: parts[3],
		stageCode: parts[4],
		methodCode: parts[5],
		typeCode: parts[6],
		openingAt: parts[7],
		publishedFlag: parts[8],
	};
}

function parseRwandaDateTime(value: string | undefined): Date | undefined {
	const cleaned = cleanText(value);
	const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
	if (!match) return undefined;
	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	const hour = Number(match[4] ?? 0);
	const minute = Number(match[5] ?? 0);
	if (!day || !month || !year) return undefined;
	return new Date(year, month - 1, day, hour, minute);
}

function methodLabel(code: string): string {
	switch (code.toUpperCase()) {
		case "ICB":
			return "International Competitive Bidding";
		case "NCB":
			return "National Competitive Bidding";
		case "RFQ":
			return "Request for Quotation";
		case "SS":
			return "Single Source";
		default:
			return code || "UMUCYO tender";
	}
}

function tenderTypeLabel(code: string): string {
	switch (code.toUpperCase()) {
		case "C":
			return "Consultant Services";
		case "G":
			return "Goods";
		case "NC":
			return "Non Consultant Services";
		case "W":
			return "Works";
		default:
			return code || "Tender";
	}
}

function inferOpportunityType(fields: UmucyoRadioFields, displayTenderNo: string): OpportunityData["opportunityType"] {
	const haystack = `${fields.title} ${fields.methodCode} ${fields.typeCode} ${displayTenderNo}`.toLowerCase();
	if (/\b(eoi|expression of interest)\b/.test(haystack)) return "eoi";
	if (fields.typeCode.toUpperCase() === "C" || /\b(rfp|request for proposal|consultant|consulting)\b/.test(haystack)) return "rfp";
	return "tender";
}

function organizationFromDisplayTenderNo(displayTenderNo: string): string {
	const suffix = cleanText(displayTenderNo.split("/").pop());
	return suffix && !/^\d+$/.test(suffix) ? suffix : "Rwanda UMUCYO";
}

function sourceIdFor(internalReference: string): string {
	return `umucyo-${internalReference.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function portalUrlFor(sourceUrl: string, internalReference: string): string {
	const base = sourceUrl || UMUCYO_ADVERTISING_URL;
	return `${base.split("#")[0]}#${encodeURIComponent(internalReference)}`;
}

function opportunityFromRow(rowHtml: string, sourceUrl: string): OpportunityData | undefined {
	const fields = radioValue(rowHtml);
	if (!fields) return undefined;
	const parsed = parseRadioFields(fields);
	if (!parsed) return undefined;

	const cells = cellHtml(rowHtml);
	const displayTenderNo = stripHtml(cells[2] ?? parsed.internalReference).replace(/\s+/g, " ");
	const status = stripHtml(cells[3] ?? "");
	const advertisedAt = stripHtml(cells[4] ?? "");
	const deadlineText = stripHtml(cells[5] ?? parsed.deadline);
	const openingText = stripHtml(cells[6] ?? parsed.openingAt);
	const stageType = stripHtml(cells[7] ?? "");
	const method = methodLabel(parsed.methodCode);
	const tenderType = tenderTypeLabel(parsed.typeCode);
	const portalUrl = portalUrlFor(sourceUrl, parsed.internalReference);

	return {
		title: parsed.title,
		source: "umucyo_rwanda",
		sourceId: sourceIdFor(parsed.internalReference),
		noticeId: displayTenderNo || parsed.internalReference,
		organization: organizationFromDisplayTenderNo(displayTenderNo),
		countryRegion: "Rwanda",
		category: `${tenderType} - ${method}`,
		opportunityType: inferOpportunityType(parsed, displayTenderNo),
		publishedDate: parseRwandaDateTime(advertisedAt),
		deadline: parseRwandaDateTime(deadlineText || parsed.deadline),
		portalUrl,
		documentUrl: portalUrl,
		rfpLink: portalUrl,
		projectSummary: [
			`Status: ${status || "Published"}`,
			`Tender method: ${method}`,
			`Tender type: ${tenderType}`,
			deadlineText ? `Submission deadline: ${deadlineText}` : undefined,
			openingText ? `Planned opening: ${openingText}` : undefined,
			stageType ? `Stage: ${stageType}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Submit through Rwanda UMUCYO public e-procurement system.",
		tags: ["umucyo", "rwanda", "national-procurement", "source-api"],
		metadata: {
			umucyoRwanda: {
				sourcePage: sourceUrl,
				internalReference: parsed.internalReference,
				displayTenderNo,
				procuringEntityCode: parsed.procuringEntityCode,
				status,
				methodCode: parsed.methodCode,
				typeCode: parsed.typeCode,
				stageCode: parsed.stageCode,
				publishedFlag: parsed.publishedFlag,
				advertisedAt,
				deadlineText,
				openingText,
				stageType,
			},
		},
	};
}

export function parseUmucyoAdvertisingHtml(html: string, sourceUrl = UMUCYO_ADVERTISING_URL): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const rowMatch of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
		const opportunity = opportunityFromRow(rowMatch[0], sourceUrl);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchUmucyoAdvertisingHtml(sourceUrl: string): Promise<string> {
	const response = await fetch(sourceUrl || UMUCYO_ADVERTISING_URL, {
		signal: AbortSignal.timeout(20000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`UMUCYO advertising fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

export const umucyoRwandaParser: TenderParser = {
	sourceId: "umucyo_rwanda",
	name: "Rwanda UMUCYO Advertising",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const html = input.html || input.markdown || await fetchUmucyoAdvertisingHtml(input.url || UMUCYO_ADVERTISING_URL);
			return {
				opportunities: parseUmucyoAdvertisingHtml(html, input.url || UMUCYO_ADVERTISING_URL),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		const url = new URL(baseUrl || UMUCYO_ADVERTISING_URL, UMUCYO_ADVERTISING_URL);
		if (!url.searchParams.has("recordCountPerPage")) {
			url.searchParams.set("recordCountPerPage", "50");
		}
		return url.toString();
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(umucyoRwandaParser);
