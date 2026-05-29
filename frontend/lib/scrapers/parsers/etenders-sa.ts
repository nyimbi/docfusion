import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const ETENDERS_SA_API_BASE_URL = "https://ocds-api.etenders.gov.za/api/OCDSReleases";
const ETENDERS_SA_RELEASE_URL = `${ETENDERS_SA_API_BASE_URL}/release`;
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_API_PAGES = 2;

type EtendersSaDocument = {
	id?: string | null;
	documentType?: string | null;
	title?: string | null;
	description?: string | null;
	url?: string | null;
	datePublished?: string | null;
	dateModified?: string | null;
	format?: string | null;
	language?: string | null;
};

type EtendersSaTender = {
	id?: string | null;
	title?: string | null;
	status?: string | null;
	category?: string | null;
	province?: string | null;
	deliveryLocation?: string | null;
	specialConditions?: string | null;
	mainProcurementCategory?: string | null;
	additionalProcurementCategories?: string[] | null;
	description?: string | null;
	eligibilityCriteria?: string | null;
	submissionMethod?: string[] | null;
	submissionMethodDetails?: string | null;
	value?: {
		amount?: number | null;
		currency?: string | null;
	} | null;
	documents?: EtendersSaDocument[] | null;
	tenderPeriod?: {
		startDate?: string | null;
		endDate?: string | null;
	} | null;
	procuringEntity?: {
		id?: string | null;
		name?: string | null;
	} | null;
	procurementMethod?: string | null;
	procurementMethodDetails?: string | null;
	briefingSession?: {
		isSession?: boolean | null;
		compulsory?: boolean | null;
		date?: string | null;
		venue?: string | null;
	} | null;
	contactPerson?: {
		name?: string | null;
		email?: string | null;
		telephoneNumber?: string | null;
		faxNumber?: string | null;
	} | null;
};

type EtendersSaRelease = {
	ocid?: string | null;
	id?: string | null;
	date?: string | null;
	tag?: string[] | null;
	initiationType?: string | null;
	tender?: EtendersSaTender | null;
	buyer?: {
		id?: string | null;
		name?: string | null;
	} | null;
};

type EtendersSaReleasePackage = {
	releases?: EtendersSaRelease[] | null;
	links?: {
		next?: string | null;
	} | null;
};

function dateOnly(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number): Date {
	const date = new Date(value.getTime());
	date.setUTCDate(date.getUTCDate() + days);
	return date;
}

function utcStartOfDay(value: Date): Date {
	const date = new Date(value.getTime());
	date.setUTCHours(0, 0, 0, 0);
	return date;
}

function dateDaysAgo(now: Date, days: number): Date {
	return utcStartOfDay(addUtcDays(now, -days));
}

export function etendersSaOcdsApiUrl(sourceUrl = ETENDERS_SA_API_BASE_URL, now = new Date()): string {
	const url = new URL(sourceUrl || ETENDERS_SA_API_BASE_URL, ETENDERS_SA_API_BASE_URL);
	if (!url.searchParams.has("PageNumber")) {
		url.searchParams.set("PageNumber", "1");
	}
	if (!url.searchParams.has("PageSize")) {
		url.searchParams.set("PageSize", String(DEFAULT_PAGE_SIZE));
	}
	if (!url.searchParams.has("dateFrom")) {
		url.searchParams.set("dateFrom", dateOnly(dateDaysAgo(now, DEFAULT_LOOKBACK_DAYS)));
	}
	if (!url.searchParams.has("dateTo")) {
		url.searchParams.set("dateTo", dateOnly(now));
	}
	return url.toString();
}

function maxApiPages(): number {
	const parsed = Number(process.env.ETENDERS_SA_MAX_API_PAGES ?? DEFAULT_MAX_API_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_API_PAGES;
	return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function parseIsoDate(value: string | null | undefined): Date | undefined {
	if (!value || value.startsWith("0001-01-01")) return undefined;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function isExpired(deadline: Date | undefined, now: Date): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function isOpenTender(tender: EtendersSaTender, deadline: Date | undefined, now: Date): boolean {
	const status = cleanText(tender.status).toLowerCase();
	if (["cancelled", "canceled", "complete", "completed", "unsuccessful", "withdrawn"].includes(status)) {
		return false;
	}
	return !isExpired(deadline, now);
}

function releaseUrl(release: EtendersSaRelease): string {
	return release.ocid
		? `${ETENDERS_SA_RELEASE_URL}/${encodeURIComponent(release.ocid)}`
		: "https://www.etenders.gov.za/Home/opportunities?id=1";
}

function primaryDocument(documents: EtendersSaDocument[] | null | undefined): EtendersSaDocument | undefined {
	const available = (documents ?? []).filter((document) => cleanText(document.url));
	return available.find((document) => /\.(pdf|docx?|xlsx?|zip)(\?|$)/i.test(document.url ?? ""))
		?? available[0];
}

function inferOpportunityType(tender: EtendersSaTender): OpportunityData["opportunityType"] {
	const haystack = [
		tender.title,
		tender.description,
		tender.procurementMethod,
		tender.procurementMethodDetails,
		...(tender.additionalProcurementCategories ?? []),
		...(tender.documents ?? []).map((document) => document.title),
	].filter(Boolean).join(" ").toLowerCase();
	if (/\b(expression of interest|eoi|request for information|rfi)\b/.test(haystack)) return "eoi";
	if (/\b(request for proposal|rfp|proposal|consulting|consultancy|consultant)\b/.test(haystack)) return "rfp";
	return "tender";
}

function tenderTitle(tender: EtendersSaTender): string {
	const title = cleanText(tender.title);
	const description = cleanText(tender.description);
	if (!title) return description;
	if (!description || description.toLowerCase().includes(title.toLowerCase())) return title;
	if (title.split(/\s+/).length <= 4 && description.length <= 180) {
		return `${title} - ${description}`;
	}
	return title;
}

function valueSummary(tender: EtendersSaTender): string | undefined {
	const amount = tender.value?.amount;
	const currency = cleanText(tender.value?.currency);
	if (!amount || amount <= 0) return undefined;
	return `${currency || "ZAR"} ${amount}`;
}

function opportunityFromRelease(release: EtendersSaRelease, now: Date): OpportunityData | undefined {
	const tender = release.tender;
	if (!tender) return undefined;
	const noticeId = cleanText(tender.id ?? release.ocid ?? release.id);
	if (!noticeId) return undefined;

	const deadline = parseIsoDate(tender.tenderPeriod?.endDate);
	if (!isOpenTender(tender, deadline, now)) return undefined;

	const title = tenderTitle(tender);
	if (!title) return undefined;

	const publishedDate = parseIsoDate(tender.tenderPeriod?.startDate ?? release.date);
	const document = primaryDocument(tender.documents);
	const portalUrl = releaseUrl(release);
	const method = cleanText(tender.procurementMethodDetails ?? tender.procurementMethod);
	const organization = cleanText(tender.procuringEntity?.name ?? release.buyer?.name);
	const sourceId = `etenders-sa-${release.ocid ?? noticeId}`;
	const briefing = tender.briefingSession;
	const contact = tender.contactPerson;

	return {
		title,
		source: "etenders_sa",
		sourceId,
		noticeId,
		organization: organization || "South Africa National Treasury eTenders",
		countryRegion: tender.province ? `South Africa - ${cleanText(tender.province)}` : "South Africa",
		category: method || cleanText(tender.mainProcurementCategory) || "South Africa eTenders",
		sector: cleanText(tender.category) || undefined,
		opportunityType: inferOpportunityType(tender),
		publishedDate,
		deadline,
		portalUrl,
		documentUrl: document?.url ?? portalUrl,
		rfpLink: document?.url ?? portalUrl,
		budgetNumeric: tender.value?.amount && tender.value.amount > 0 ? tender.value.amount : undefined,
		budgetCurrency: cleanText(tender.value?.currency) || undefined,
		budgetValue: valueSummary(tender),
		projectSummary: [
			cleanText(tender.description),
			method ? `Procurement method: ${method}` : undefined,
			tender.mainProcurementCategory ? `Main category: ${cleanText(tender.mainProcurementCategory)}` : undefined,
			tender.deliveryLocation ? `Delivery location: ${cleanText(tender.deliveryLocation)}` : undefined,
			deadline ? `Deadline: ${dateOnly(deadline)}` : undefined,
			briefing?.isSession ? `Briefing session${briefing.compulsory ? " (compulsory)" : ""}: ${cleanText(briefing.date)} ${cleanText(briefing.venue)}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: cleanText([...(tender.submissionMethod ?? []), tender.submissionMethodDetails].filter(Boolean).join("; ")) || undefined,
		keyRequirements: [
			tender.eligibilityCriteria ? `Eligibility: ${cleanText(tender.eligibilityCriteria)}` : undefined,
			tender.specialConditions ? `Special conditions: ${cleanText(tender.specialConditions)}` : undefined,
		].filter(Boolean).join("; ") || undefined,
		tags: ["etenders-sa", "south-africa", "national-procurement", "ocds", "source-api"],
		metadata: {
			etendersSa: {
				ocid: release.ocid ?? null,
				releaseId: release.id ?? null,
				tenderId: tender.id ?? null,
				status: tender.status ?? null,
				province: tender.province ?? null,
				documents: (tender.documents ?? []).map((item) => ({
					title: item.title ?? item.description ?? item.id ?? null,
					url: item.url ?? null,
					format: item.format ?? null,
				})),
				contact: contact ? {
					name: contact.name ?? null,
					email: contact.email ?? null,
					telephoneNumber: contact.telephoneNumber ?? null,
				} : null,
			},
		},
	};
}

export function parseEtendersSaReleasePackage(
	payload: EtendersSaReleasePackage,
	now = new Date()
): OpportunityData[] {
	const opportunities: OpportunityData[] = [];
	const seen = new Set<string>();
	for (const release of payload.releases ?? []) {
		const opportunity = opportunityFromRelease(release, now);
		if (!opportunity) continue;
		const key = `${opportunity.source}:${opportunity.sourceId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchEtendersSaReleases(sourceUrl: string): Promise<EtendersSaReleasePackage> {
	let nextUrl: string | undefined = etendersSaOcdsApiUrl(sourceUrl);
	const releases: EtendersSaRelease[] = [];
	let lastResponse: EtendersSaReleasePackage = {};

	for (let page = 0; nextUrl && page < maxApiPages(); page += 1) {
		const response = await fetch(nextUrl, {
			headers: {
				Accept: "application/json",
				"User-Agent": "DocFusionRfpSourceCollector/1.0",
			},
		});
		if (!response.ok) {
			throw new Error(`South Africa eTenders OCDS endpoint returned HTTP ${response.status}`);
		}
		const payload = await response.json() as EtendersSaReleasePackage;
		lastResponse = payload;
		releases.push(...(payload.releases ?? []));
		nextUrl = payload.links?.next ?? undefined;
	}

	return {
		...lastResponse,
		releases,
	};
}

export const etendersSaParser: TenderParser = {
	sourceId: "etenders_sa",
	name: "South Africa eTenders OCDS Releases",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = await fetchEtendersSaReleases(input.url);
			return {
				opportunities: parseEtendersSaReleasePackage(response),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch South Africa eTenders releases",
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

registerParser(etendersSaParser);

export default etendersSaParser;
