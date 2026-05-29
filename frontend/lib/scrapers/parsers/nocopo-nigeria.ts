import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const NOCOPO_BASE_URL = "https://nocopo.bpp.gov.ng";
export const NOCOPO_OPEN_DATA_URL = `${NOCOPO_BASE_URL}/Open-Data`;
const NOCOPO_HANDLER_URL = `${NOCOPO_BASE_URL}/PublishedRecordHandler.ashx`;
const DEFAULT_PAGE_LENGTH = 25;
const DEFAULT_MAX_PAGES = 3;

type NocopoRow = {
	ID?: number;
	MDA_Name?: string | null;
	MDA_NAME_ONLY?: string | null;
	MDA_Code?: string | null;
	pi_Project_Title?: string | null;
	pi_Package_Number?: string | null;
	pi_Lot_Number?: string | null;
	DatePublished?: string | null;
	pb_BudgetYear?: string | null;
	pb_Budget_Currency_FK_Item?: string | null;
	pb_Budget_Amount?: number | null;
	pb_Project_Estimated_Currency_FK_Item?: string | null;
	pb_Project_Estimated_Amount?: number | null;
	pb_Project_State_Item?: string | null;
	bd_Procurement_Category_FK_Item?: string | null;
	bd_Contract_type_FK_Item?: string | null;
	bd_Procurement_Method_FK_Item?: string | null;
	bd_Selection_Method_FK_Item?: string | null;
	ps_Advert_of_EoI_End_date?: string | null;
	ps_RfP_Invit_Req_Proposals_End_Date?: string | null;
	ps_Prep_of_Bid_Doc_Advert_End_Date?: string | null;
	ip_Advert_for_PreQual_End_Date?: string | null;
	tp_Tendering_Period_End_Date?: string | null;
};

type NocopoResponse = {
	iTotalRecords?: number;
	iTotalDisplayRecords?: number;
	aaData?: NocopoRow[];
	data?: NocopoRow[];
};

function nonEmpty(value: unknown): string | undefined {
	const cleaned = cleanText(String(value ?? ""));
	return cleaned && cleaned !== "'" ? cleaned : undefined;
}

function validDate(value: string | null | undefined): Date | undefined {
	const cleaned = nonEmpty(value);
	if (!cleaned || /^0*1-0?1-0?1/i.test(cleaned) || /^0001-01-01/i.test(cleaned)) {
		return undefined;
	}
	const parsed = new Date(cleaned);
	return Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() <= 1901 ? undefined : parsed;
}

function deadlineFor(row: NocopoRow): Date | undefined {
	return [
		row.tp_Tendering_Period_End_Date,
		row.ps_RfP_Invit_Req_Proposals_End_Date,
		row.ps_Advert_of_EoI_End_date,
		row.ip_Advert_for_PreQual_End_Date,
		row.ps_Prep_of_Bid_Doc_Advert_End_Date,
	].map(validDate).find(Boolean);
}

function inferOpportunityType(row: NocopoRow): OpportunityData["opportunityType"] {
	const haystack = [
		row.pi_Project_Title,
		row.bd_Procurement_Method_FK_Item,
		row.bd_Selection_Method_FK_Item,
		row.bd_Contract_type_FK_Item,
	].map((value) => nonEmpty(value)?.toLowerCase()).filter(Boolean).join(" ");
	if (/\b(eoi|expression of interest)\b/.test(haystack)) return "eoi";
	if (/\b(rfp|request for proposal|consultancy|consultant)\b/.test(haystack)) return "rfp";
	if (/\bgrant\b/.test(haystack)) return "grant";
	if (/\bcontract\b/.test(haystack)) return "contract";
	return "tender";
}

function sourceIdFor(row: NocopoRow, title: string): string {
	const ocid = nonEmpty(row.MDA_Code);
	if (ocid) return `nocopo-${ocid}`;
	const fallback = [
		row.ID,
		row.pi_Package_Number,
		row.pi_Lot_Number,
		title,
	].map((value) => nonEmpty(value)).filter(Boolean).join("-");
	return `nocopo-${fallback.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "record"}`;
}

function jsonDownloadUrl(ocid: string | undefined): string | undefined {
	if (!ocid) return undefined;
	const url = new URL("/downloadJson.ashx", NOCOPO_BASE_URL);
	url.searchParams.set("ty", "1");
	url.searchParams.set("ocid", ocid);
	return url.toString();
}

function portalUrlFor(row: NocopoRow): string {
	const ocid = nonEmpty(row.MDA_Code);
	if (!ocid) return NOCOPO_OPEN_DATA_URL;
	const url = new URL(NOCOPO_OPEN_DATA_URL);
	url.searchParams.set("search", ocid);
	return url.toString();
}

function opportunityFromRow(row: NocopoRow): OpportunityData | undefined {
	const title = nonEmpty(row.pi_Project_Title);
	if (!title) return undefined;
	const ocid = nonEmpty(row.MDA_Code);
	const organization = nonEmpty(row.MDA_NAME_ONLY) ?? nonEmpty(row.MDA_Name) ?? "Nigeria Open Contracting Portal";
	const procurementMethod = nonEmpty(row.bd_Procurement_Method_FK_Item);
	const procurementCategory = nonEmpty(row.bd_Procurement_Category_FK_Item);
	const contractType = nonEmpty(row.bd_Contract_type_FK_Item);
	const selectionMethod = nonEmpty(row.bd_Selection_Method_FK_Item);
	const budgetCurrency = nonEmpty(row.pb_Project_Estimated_Currency_FK_Item) ?? nonEmpty(row.pb_Budget_Currency_FK_Item);
	const budgetNumeric = Number(row.pb_Project_Estimated_Amount || row.pb_Budget_Amount || 0) || undefined;
	const sourceJsonUrl = jsonDownloadUrl(ocid);

	return {
		title,
		source: "nocopo_nigeria",
		sourceId: sourceIdFor(row, title),
		noticeId: ocid ?? nonEmpty(row.pi_Package_Number),
		organization,
		countryRegion: nonEmpty(row.pb_Project_State_Item) ? `Nigeria - ${nonEmpty(row.pb_Project_State_Item)}` : "Nigeria",
		category: procurementCategory ?? procurementMethod ?? "NOCOPO published procurement",
		opportunityType: inferOpportunityType(row),
		publishedDate: validDate(row.DatePublished),
		deadline: deadlineFor(row),
		portalUrl: portalUrlFor(row),
		rfpLink: sourceJsonUrl ?? portalUrlFor(row),
		budgetCurrency,
		budgetNumeric,
		budgetValue: budgetNumeric ? `${budgetCurrency ?? "NGN"} ${budgetNumeric.toLocaleString("en-US")}` : undefined,
		projectSummary: [
			nonEmpty(row.pi_Package_Number) ? `Package: ${nonEmpty(row.pi_Package_Number)}` : undefined,
			nonEmpty(row.pi_Lot_Number) ? `Lot: ${nonEmpty(row.pi_Lot_Number)}` : undefined,
			nonEmpty(row.pb_BudgetYear) ? `Budget year: ${nonEmpty(row.pb_BudgetYear)}` : undefined,
			procurementMethod ? `Procurement method: ${procurementMethod}` : undefined,
			selectionMethod ? `Selection method: ${selectionMethod}` : undefined,
			contractType ? `Contract type: ${contractType}` : undefined,
			sourceJsonUrl ? `OCDS JSON: ${sourceJsonUrl}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: "Use the Nigeria Open Contracting Portal record to inspect the procurement package and contracting authority details.",
		tags: ["nocopo", "nigeria", "open-contracting", "national-procurement", "source-api"],
		metadata: {
			nocopo: {
				id: row.ID,
				ocid,
				totalCount: "TotalCount" in row ? (row as { TotalCount?: number }).TotalCount : undefined,
				packageNumber: nonEmpty(row.pi_Package_Number),
				lotNumber: nonEmpty(row.pi_Lot_Number),
				budgetYear: nonEmpty(row.pb_BudgetYear),
				procurementCategory,
				procurementMethod,
				selectionMethod,
				contractType,
				sourceJsonUrl,
			},
		},
	};
}

export function parseNocopoPublishedRecordResponse(rawJson: string): OpportunityData[] {
	const parsed = JSON.parse(rawJson) as NocopoResponse;
	const rows = parsed.aaData ?? parsed.data ?? [];
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const row of rows) {
		const opportunity = opportunityFromRow(row);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

function pageLength(): number {
	const parsed = Number(process.env.NOCOPO_PAGE_LENGTH ?? DEFAULT_PAGE_LENGTH);
	if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LENGTH;
	return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function maxPages(): number {
	const parsed = Number(process.env.NOCOPO_MAX_PAGES ?? DEFAULT_MAX_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_PAGES;
	return Math.min(20, Math.max(1, Math.trunc(parsed)));
}

function sourceSearch(sourceUrl: string): string | undefined {
	try {
		const search = new URL(sourceUrl || NOCOPO_OPEN_DATA_URL).searchParams.get("search");
		return search?.trim() || undefined;
	} catch {
		return undefined;
	}
}

function handlerUrl(sourceUrl: string, page: number): string {
	const length = pageLength();
	const url = new URL(NOCOPO_HANDLER_URL);
	url.searchParams.set("sEcho", String(page));
	url.searchParams.set("iDisplayStart", String((page - 1) * length));
	url.searchParams.set("iDisplayLength", String(length));
	url.searchParams.set("iSortCol_0", "3");
	url.searchParams.set("sSortDir_0", "desc");
	url.searchParams.set("iSortingCols", "1");
	url.searchParams.set("sSearch", sourceSearch(sourceUrl) ?? "");
	return url.toString();
}

async function fetchNocopoPage(sourceUrl: string, page: number): Promise<string> {
	const response = await fetch(handlerUrl(sourceUrl, page), {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "application/json,text/javascript,*/*",
			"Referer": NOCOPO_OPEN_DATA_URL,
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
			"X-Requested-With": "XMLHttpRequest",
		},
	});
	if (!response.ok) {
		throw new Error(`NOCOPO published records fetch failed: ${response.status} ${response.statusText}`);
	}
	const body = await response.text();
	if (!body.trim().startsWith("{")) {
		throw new Error("NOCOPO published records endpoint returned non-JSON content");
	}
	return body;
}

async function fetchNocopoOpportunities(sourceUrl: string): Promise<OpportunityData[]> {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (let page = 1; page <= maxPages(); page += 1) {
		const pageOpportunities = parseNocopoPublishedRecordResponse(await fetchNocopoPage(sourceUrl, page));
		if (pageOpportunities.length === 0) break;
		for (const opportunity of pageOpportunities) {
			if (!opportunity.sourceId || seen.has(opportunity.sourceId)) continue;
			seen.add(opportunity.sourceId);
			opportunities.push(opportunity);
		}
	}
	return opportunities;
}

export const nocopoNigeriaParser: TenderParser = {
	sourceId: "nocopo_nigeria",
	name: "Nigeria NOCOPO Published Procurement Records",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const rawJson = (input.html || input.markdown || "").trim();
			if (rawJson.startsWith("{")) {
				return { opportunities: parseNocopoPublishedRecordResponse(rawJson) };
			}
			return { opportunities: await fetchNocopoOpportunities(input.url || NOCOPO_OPEN_DATA_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string, page: number): string {
		return handlerUrl(baseUrl || NOCOPO_OPEN_DATA_URL, page);
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(nocopoNigeriaParser);
