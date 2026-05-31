import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, parseDate, registerParser } from "./types";

export const IDB_PROCUREMENT_NOTICES_URL = "https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/procurement-notices";
export const IDB_PROCUREMENT_DATASET_URL = "https://data.iadb.org/dataset/project-procurement-bidding-notices-and-notification-of-contract-awards";

const IDB_RESOURCE_ID = "856aabfd-2c6a-48fb-a8b8-19f3ff443618";
const IDB_DATASTORE_LIMIT = 200;
const IDB_DATASTORE_URL = `https://data.iadb.org/api/3/action/datastore_search?resource_id=${IDB_RESOURCE_ID}&limit=${IDB_DATASTORE_LIMIT}&sort=publicationdate%20desc`;

type IdbRecord = {
	noticeid?: string;
	type?: string;
	countryname?: string;
	projectnumber?: string;
	proyecturl?: string;
	loannumber?: string;
	noticetitle?: string;
	ezshareid?: string;
	documenturl?: string;
	projectname?: string;
	publicationdate?: string;
	deadline?: string;
	sector?: string;
	sectorenglnm?: string;
	projectstatus?: string;
	procurement_id?: string;
	process_id?: string;
	category_nm?: string;
	prcrmnt_mthd_engl_nm?: string;
	process_nm?: string;
	process_desc?: string;
};

function text(value: unknown): string {
	return cleanText(typeof value === "string" ? value : "");
}

function absoluteUrl(rawUrl: string | undefined, sourceUrl: string): string | undefined {
	if (!rawUrl) return undefined;
	try {
		const parsed = new URL(rawUrl.trim(), sourceUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 46);
}

function sourceIdFor(record: IdbRecord, title: string): string {
	const id = text(record.noticeid) || text(record.process_id) || text(record.procurement_id) || slugify(title);
	return `idb-${slugify(id) || "notice"}`;
}

function parseIdbDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	return parseDate(value.replace(/\s+\d{1,2}:\d{2}:\d{2}.*$/, ""));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	if (!deadline) return false;
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
	return deadlineDate < today;
}

function inferOpportunityType(record: IdbRecord, title: string): OpportunityData["opportunityType"] {
	const haystack = `${record.type ?? ""} ${record.prcrmnt_mthd_engl_nm ?? ""} ${record.category_nm ?? ""} ${title}`.toLowerCase();
	if (/\bnon-consulting services?\b/.test(haystack)) return "tender";
	if (/\bexpression of interest\b|\beoi\b/.test(haystack)) return "eoi";
	if (/\brequest for proposals?\b|\brfp\b|consultant|consulting/.test(haystack)) return "rfp";
	return "tender";
}

function isBiddingNotice(record: IdbRecord): boolean {
	const noticeType = text(record.type).toLowerCase();
	if (!noticeType) return false;
	if (/\baward\b|contract award|notification of contract/i.test(noticeType)) return false;
	return true;
}

function recordToOpportunity(record: IdbRecord, sourceUrl: string): OpportunityData | undefined {
	if (!isBiddingNotice(record)) return undefined;

	const title = text(record.noticetitle) || text(record.process_nm);
	if (title.length < 8) return undefined;

	const deadline = parseIdbDate(record.deadline);
	if (!deadline || isExpired(deadline)) return undefined;

	const documentUrl = absoluteUrl(text(record.documenturl), sourceUrl);
	const portalUrl = absoluteUrl(text(record.proyecturl), sourceUrl) ?? documentUrl ?? IDB_PROCUREMENT_NOTICES_URL;
	const sector = text(record.sectorenglnm) || text(record.sector);
	const country = text(record.countryname);
	const method = text(record.prcrmnt_mthd_engl_nm);
	const category = text(record.category_nm) || text(record.type) || "IDB procurement notice";
	const projectName = text(record.projectname);
	const processDescription = text(record.process_desc);

	return {
		title,
		source: "idb",
		sourceId: sourceIdFor(record, title),
		noticeId: text(record.noticeid) || undefined,
		organization: "Inter-American Development Bank",
		funder: "Inter-American Development Bank",
		countryRegion: country || "Latin America and the Caribbean",
		category,
		sector: sector || undefined,
		opportunityType: inferOpportunityType(record, title),
		deadline,
		publishedDate: parseIdbDate(record.publicationdate),
		portalUrl,
		documentUrl,
		rfpLink: documentUrl ?? portalUrl,
		projectSummary: [
			projectName ? `Project: ${projectName}` : undefined,
			processDescription || undefined,
			method ? `Procurement method: ${method}` : undefined,
			country ? `Country: ${country}` : undefined,
			sector ? `Sector: ${sector}` : undefined,
		].filter(Boolean).join("; ") || `${title}.`,
		submissionMethod: "Review the IDB procurement notice document for submission requirements and deadline details.",
		tags: ["idb", "iadb", "development-bank", "source-api", "source-documents"],
		metadata: {
			idb: {
				sourceUrl,
				resourceId: IDB_RESOURCE_ID,
				noticeType: text(record.type) || undefined,
				projectNumber: text(record.projectnumber) || undefined,
				loanNumber: text(record.loannumber) || undefined,
				procurementId: text(record.procurement_id) || undefined,
				processId: text(record.process_id) || undefined,
				ezShareId: text(record.ezshareid) || undefined,
				method: method || undefined,
				documentLinks: documentUrl ? [{ url: documentUrl, label: title }] : [],
			},
		},
	};
}

function recordsFromPayload(payload: unknown): IdbRecord[] {
	if (Array.isArray(payload)) return payload as IdbRecord[];
	if (!payload || typeof payload !== "object") return [];
	const result = (payload as { result?: unknown }).result;
	if (!result || typeof result !== "object") return [];
	const records = (result as { records?: unknown }).records;
	return Array.isArray(records) ? records as IdbRecord[] : [];
}

export function parseIdbProcurementData(payload: unknown, sourceUrl = IDB_PROCUREMENT_NOTICES_URL): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (const record of recordsFromPayload(payload)) {
		const opportunity = recordToOpportunity(record, sourceUrl);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchIdbProcurementPayload(): Promise<unknown> {
	const response = await fetch(IDB_DATASTORE_URL, {
		method: "GET",
		signal: AbortSignal.timeout(30000),
		headers: {
			Accept: "application/json",
			"User-Agent": "DocFusionRfpSourceCollector/1.0",
		},
	});
	if (!response.ok) throw new Error(`IDB procurement datastore returned HTTP ${response.status}`);
	return response.json();
}

export const idbParser: TenderParser = {
	sourceId: "idb",
	name: "IDB Project Procurement Notices",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const rawContent = input.html ?? input.markdown;
			const payload = rawContent?.trim().startsWith("{") || rawContent?.trim().startsWith("[")
				? JSON.parse(rawContent)
				: await fetchIdbProcurementPayload();
			return { opportunities: parseIdbProcurementData(payload, input.url || IDB_PROCUREMENT_NOTICES_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch IDB procurement notices",
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || IDB_PROCUREMENT_NOTICES_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(idbParser);

export default idbParser;
