import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

export const MANEPS_ACTIVE_TENDERS_URL = "https://maneps.mw/rms/api/tender-notices/active-tenders-search";
const MANEPS_BASE_URL = "https://maneps.mw";
const DEFAULT_TAKE = 10;
const DEFAULT_MAX_PAGES = 6;

type ManepsProcurementMechanism = {
	PRProcurementMechanisms?: {
		organizationName?: string | null;
		fundingSource?: string | null;
		procurementMethod?: string | null;
		procurementType?: string | null;
		donor?: string[] | null;
		targetGroup?: string[] | null;
		isOnline?: boolean | null;
		invitationType?: string | null;
		stage?: string | null;
		marketType?: string | null;
	} | null;
	invitationType?: string | null;
	marketApproach?: string | null;
	stage?: string | null;
};

type ManepsTender = {
	id?: string | null;
	objectType?: string | null;
	name?: string | null;
	description?: string | null;
	procurementCategory?: string | null;
	procurementReferenceNumber?: string | null;
	status?: string | null;
	budgetAmount?: number | null;
	budgetAmountCurrency?: string | null;
	organizationName?: string | null;
	publishedDate?: string | null;
	openingDate?: string | null;
	closingDate?: string | null;
	tenderParticipationFee?: number | null;
	tenderProcurementMechanism?: ManepsProcurementMechanism | null;
};

export type ManepsActiveTendersResponse = {
	count?: number | null;
	data?: ManepsTender[] | null;
};

function maxPages(): number {
	const parsed = Number(process.env.MANEPS_MAX_PAGES ?? DEFAULT_MAX_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_PAGES;
	return Math.min(10, Math.max(1, Math.trunc(parsed)));
}

function parseIsoDate(value: string | null | undefined): Date | undefined {
	if (!value) return undefined;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function utcStartOfDay(value: Date): Date {
	const date = new Date(value.getTime());
	date.setUTCHours(0, 0, 0, 0);
	return date;
}

function isExpired(deadline: Date | undefined, now: Date): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function portalUrlFor(tender: ManepsTender): string {
	const id = encodeURIComponent(cleanText(tender.id) || "");
	if (!id) return `${MANEPS_BASE_URL}/procurement-notice`;
	const objectType = cleanText(tender.objectType).toLowerCase();
	return objectType === "rfx"
		? `${MANEPS_BASE_URL}/procurement-notice/rfx/${id}`
		: `${MANEPS_BASE_URL}/procurement-notice/tender/${id}`;
}

function inferOpportunityType(tender: ManepsTender): OpportunityData["opportunityType"] {
	const mechanism = tender.tenderProcurementMechanism?.PRProcurementMechanisms;
	const haystack = [
		tender.name,
		tender.description,
		tender.procurementCategory,
		mechanism?.procurementMethod,
		mechanism?.procurementType,
	].join(" ").toLowerCase();
	if (/\b(eoi|expression of interest|request for information|rfi)\b/.test(haystack)) return "eoi";
	if (/\b(rfp|request for proposal|consultancy|consulting|consultant)\b/.test(haystack)) return "rfp";
	return "tender";
}

function tenderTitle(tender: ManepsTender): string {
	const name = cleanText(tender.name);
	const description = cleanText(tender.description);
	if (!name) return description;
	if (!description || description.toLowerCase().includes(name.toLowerCase())) return name;
	if (name.split(/\s+/).length <= 4 && description.length <= 180) {
		return `${name} - ${description}`;
	}
	return name;
}

function opportunityFromTender(tender: ManepsTender, now: Date): OpportunityData | undefined {
	const id = cleanText(tender.id);
	if (!id) return undefined;
	const title = tenderTitle(tender);
	if (!title) return undefined;
	const deadline = parseIsoDate(tender.closingDate);
	if (isExpired(deadline, now)) return undefined;

	const mechanism = tender.tenderProcurementMechanism?.PRProcurementMechanisms;
	const method = cleanText(mechanism?.procurementMethod);
	const procurementType = cleanText(mechanism?.procurementType ?? tender.procurementCategory);
	const organization = cleanText(tender.organizationName ?? mechanism?.organizationName);
	const portalUrl = portalUrlFor(tender);
	const budgetAmount = tender.budgetAmount;
	const currency = cleanText(tender.budgetAmountCurrency);

	return {
		title,
		source: "maneps_malawi",
		sourceId: `maneps-${id}`,
		noticeId: cleanText(tender.procurementReferenceNumber) || id,
		organization: organization || "MANEPS Malawi",
		countryRegion: "Malawi",
		category: method || procurementType || "MANEPS tender",
		sector: procurementType || undefined,
		opportunityType: inferOpportunityType(tender),
		publishedDate: parseIsoDate(tender.publishedDate),
		deadline,
		portalUrl,
		rfpLink: portalUrl,
		budgetNumeric: typeof budgetAmount === "number" && Number.isFinite(budgetAmount) ? budgetAmount : undefined,
		budgetCurrency: currency || undefined,
		budgetValue: typeof budgetAmount === "number" && Number.isFinite(budgetAmount)
			? `${currency || "MWK"} ${budgetAmount}`
			: undefined,
		projectSummary: [
			cleanText(tender.description) ? `Description: ${cleanText(tender.description)}` : undefined,
			method ? `Procurement method: ${method}` : undefined,
			procurementType ? `Procurement type: ${procurementType}` : undefined,
			cleanText(mechanism?.marketType) ? `Market: ${cleanText(mechanism?.marketType)}` : undefined,
			cleanText(tender.status) ? `Status: ${cleanText(tender.status)}` : undefined,
		].filter(Boolean).join("; ") || undefined,
		submissionMethod: "Submit through the Malawi National Electronic Procurement System.",
		tags: ["maneps", "malawi", "national-procurement", "source-api"],
		metadata: {
			manepsMalawi: {
				id,
				objectType: tender.objectType,
				status: tender.status,
				procurementReferenceNumber: tender.procurementReferenceNumber,
				fundingSource: mechanism?.fundingSource,
				invitationType: mechanism?.invitationType ?? tender.tenderProcurementMechanism?.invitationType,
				stage: mechanism?.stage ?? tender.tenderProcurementMechanism?.stage,
				marketType: mechanism?.marketType,
				targetGroup: mechanism?.targetGroup,
				isOnline: mechanism?.isOnline,
				openingDate: tender.openingDate,
				tenderParticipationFee: tender.tenderParticipationFee,
			},
		},
	};
}

export function parseManepsActiveTendersResponse(
	response: ManepsActiveTendersResponse,
	now = new Date()
): OpportunityData[] {
	const seen = new Set<string>();
	const opportunities: OpportunityData[] = [];
	for (const tender of response.data ?? []) {
		const opportunity = opportunityFromTender(tender, now);
		if (!opportunity?.sourceId || seen.has(opportunity.sourceId)) continue;
		seen.add(opportunity.sourceId);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchManepsPage(sourceUrl: string, skip: number): Promise<ManepsActiveTendersResponse> {
	const response = await fetch(sourceUrl || MANEPS_ACTIVE_TENDERS_URL, {
		method: "POST",
		signal: AbortSignal.timeout(20000),
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"User-Agent": "DocFusionRfpSourceCollector/1.0",
		},
		body: JSON.stringify({
			take: DEFAULT_TAKE,
			skip,
			searchParam: "",
			statuses: [],
			includeExpiredTenders: false,
		}),
	});
	if (!response.ok) {
		throw new Error(`MANEPS active tenders endpoint returned HTTP ${response.status}`);
	}
	return response.json() as Promise<ManepsActiveTendersResponse>;
}

async function fetchManepsActiveTenders(sourceUrl: string): Promise<ManepsActiveTendersResponse> {
	const data: ManepsTender[] = [];
	let count: number | undefined;
	for (let page = 0; page < maxPages(); page += 1) {
		const skip = page * DEFAULT_TAKE;
		if (count !== undefined && skip >= count) break;
		const response = await fetchManepsPage(sourceUrl, skip);
		count = typeof response.count === "number" ? response.count : count;
		const pageData = response.data ?? [];
		if (pageData.length === 0) break;
		data.push(...pageData);
	}
	return { count, data };
}

export const manepsMalawiParser: TenderParser = {
	sourceId: "maneps_malawi",
	name: "MANEPS Malawi Active Tenders",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = input.html || input.markdown
				? JSON.parse(input.html || input.markdown || "{}") as ManepsActiveTendersResponse
				: await fetchManepsActiveTenders(input.url || MANEPS_ACTIVE_TENDERS_URL);
			return { opportunities: parseManepsActiveTendersResponse(response) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch MANEPS active tenders",
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || MANEPS_ACTIVE_TENDERS_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(manepsMalawiParser);

export default manepsMalawiParser;
