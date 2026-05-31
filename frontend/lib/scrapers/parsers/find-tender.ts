import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const FIND_TENDER_API_BASE_URL = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages";
const FIND_TENDER_NOTICE_BASE_URL = "https://www.find-tender.service.gov.uk/Notice";
const DEFAULT_LIMIT = 100;
const DEFAULT_MAX_API_PAGES = 2;

type FindTenderValue = {
	amount?: number | null;
	currency?: string | null;
};

type FindTenderDocument = {
	id?: string | null;
	title?: string | null;
	description?: string | null;
	documentType?: string | null;
	url?: string | null;
	format?: string | null;
	datePublished?: string | null;
	dateModified?: string | null;
};

type FindTenderParty = {
	id?: string | null;
	name?: string | null;
	roles?: string[] | null;
	address?: {
		locality?: string | null;
		region?: string | null;
		countryName?: string | null;
	} | null;
	contactPoint?: {
		name?: string | null;
		email?: string | null;
		telephone?: string | null;
		url?: string | null;
	} | null;
	details?: {
		url?: string | null;
		buyerProfile?: string | null;
	} | null;
};

type FindTenderTender = {
	id?: string | null;
	title?: string | null;
	status?: string | null;
	description?: string | null;
	mainProcurementCategory?: string | null;
	procurementMethod?: string | null;
	procurementMethodDetails?: string | null;
	submissionMethod?: string[] | null;
	submissionMethodDetails?: string | null;
	classification?: {
		scheme?: string | null;
		id?: string | null;
		description?: string | null;
	} | null;
	value?: FindTenderValue | null;
	documents?: FindTenderDocument[] | null;
	tenderPeriod?: {
		startDate?: string | null;
		endDate?: string | null;
	} | null;
	awardPeriod?: {
		startDate?: string | null;
		endDate?: string | null;
	} | null;
	lots?: Array<{
		id?: string | null;
		title?: string | null;
		description?: string | null;
		status?: string | null;
		value?: FindTenderValue | null;
		contractPeriod?: {
			startDate?: string | null;
			endDate?: string | null;
			durationInDays?: number | null;
		} | null;
	}> | null;
	items?: Array<{
		id?: string | null;
		additionalClassifications?: Array<{
			id?: string | null;
			description?: string | null;
		}> | null;
		deliveryAddresses?: Array<{
			region?: string | null;
			countryName?: string | null;
		}> | null;
	}> | null;
};

type FindTenderRelease = {
	ocid?: string | null;
	id?: string | null;
	date?: string | null;
	tag?: string[] | null;
	description?: string | null;
	initiationType?: string | null;
	tender?: FindTenderTender | null;
	buyer?: {
		id?: string | null;
		name?: string | null;
	} | null;
	parties?: FindTenderParty[] | null;
	links?: Array<{
		rel?: string | null;
		href?: string | null;
	}> | null;
	language?: string | null;
};

type FindTenderReleasePackage = {
	releases?: FindTenderRelease[] | null;
	links?: {
		next?: string | null;
	} | null;
};

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

function findTenderApiUrl(sourceUrl = FIND_TENDER_API_BASE_URL): string {
	const url = new URL(sourceUrl || FIND_TENDER_API_BASE_URL, FIND_TENDER_API_BASE_URL);
	if (!url.pathname.includes("/api/1.0/ocdsReleasePackages")) {
		url.pathname = "/api/1.0/ocdsReleasePackages";
		url.search = "";
	}
	if (!url.searchParams.has("limit")) {
		url.searchParams.set("limit", String(DEFAULT_LIMIT));
	}
	if (!url.searchParams.has("stages")) {
		url.searchParams.set("stages", "tender");
	}
	return url.toString();
}

function maxApiPages(): number {
	const parsed = Number(process.env.FIND_TENDER_MAX_API_PAGES ?? DEFAULT_MAX_API_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_API_PAGES;
	return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function noticeUrl(release: FindTenderRelease): string {
	const id = cleanText(release.id);
	return id ? `${FIND_TENDER_NOTICE_BASE_URL}/${encodeURIComponent(id)}` : "https://www.find-tender.service.gov.uk/Search/Results";
}

function urlFromText(value: string | null | undefined): string | undefined {
	const text = cleanText(value);
	if (!text) return undefined;
	const match = text.match(/https?:\/\/[^\s<>"')]+/i);
	return match?.[0]?.replace(/[),.;]+$/, "");
}

function primaryDocumentUrl(tender: FindTenderTender, release: FindTenderRelease): string {
	const documentUrl = (tender.documents ?? [])
		.map((document) => cleanText(document.url))
		.find(Boolean);
	return documentUrl
		?? urlFromText(tender.submissionMethodDetails)
		?? noticeUrl(release);
}

function buyerParty(release: FindTenderRelease): FindTenderParty | undefined {
	return (release.parties ?? []).find((party) => (party.roles ?? []).includes("buyer"));
}

function countryRegion(release: FindTenderRelease): string {
	const buyer = buyerParty(release);
	const buyerCountry = cleanText(buyer?.address?.countryName);
	if (buyerCountry) return buyerCountry;
	const deliveryCountry = (release.tender?.items ?? [])
		.flatMap((item) => item.deliveryAddresses ?? [])
		.map((address) => cleanText(address.countryName))
		.find(Boolean);
	if (deliveryCountry) return deliveryCountry;
	const region = (release.tender?.items ?? [])
		.flatMap((item) => item.deliveryAddresses ?? [])
		.map((address) => cleanText(address.region))
		.find(Boolean);
	return region ? `United Kingdom - ${region}` : "United Kingdom";
}

function inferOpportunityType(tender: FindTenderTender): OpportunityData["opportunityType"] {
	const haystack = [
		tender.title,
		tender.description,
		tender.procurementMethod,
		tender.procurementMethodDetails,
		tender.classification?.description,
		...(tender.documents ?? []).map((document) => `${document.title ?? ""} ${document.documentType ?? ""}`),
	].filter(Boolean).join(" ").toLowerCase();
	if (/\b(expression of interest|eoi|request for information|rfi|pre-qualification|prequalification)\b/.test(haystack)) return "eoi";
	if (/\b(request for proposal|rfp|proposal|consultancy|consulting)\b/.test(haystack)) return "rfp";
	if (/\bcontract\b/.test(haystack)) return "contract";
	return "tender";
}

function valueSummary(value: FindTenderValue | null | undefined): string | undefined {
	const amount = value?.amount;
	if (!amount || amount <= 0) return undefined;
	return `${cleanText(value?.currency) || "GBP"} ${amount}`;
}

function category(tender: FindTenderTender): string {
	return cleanText(tender.procurementMethodDetails)
		|| cleanText(tender.procurementMethod)
		|| cleanText(tender.mainProcurementCategory)
		|| "UK public procurement";
}

function sourceId(release: FindTenderRelease): string {
	return cleanText(release.id ?? release.ocid ?? release.tender?.id);
}

function isOpenTender(release: FindTenderRelease, deadline: Date | undefined, now: Date): boolean {
	const tender = release.tender;
	if (!tender) return false;
	const tags = (release.tag ?? []).map((tag) => tag.toLowerCase());
	if (tags.length > 0 && !tags.includes("tender")) return false;
	const status = cleanText(tender.status).toLowerCase();
	if (["cancelled", "canceled", "complete", "completed", "withdrawn", "unsuccessful"].includes(status)) {
		return false;
	}
	return !isExpired(deadline, now);
}

function opportunityFromRelease(release: FindTenderRelease, now: Date): OpportunityData | undefined {
	const tender = release.tender;
	if (!tender) return undefined;
	const id = sourceId(release);
	if (!id) return undefined;

	const deadline = parseIsoDate(tender.tenderPeriod?.endDate ?? tender.awardPeriod?.startDate);
	if (!isOpenTender(release, deadline, now)) return undefined;

	const title = cleanText(tender.title);
	if (!title) return undefined;

	const buyer = buyerParty(release);
	const organization = cleanText(release.buyer?.name ?? buyer?.name) || "UK Find a Tender";
	const publishedDate = parseIsoDate(tender.tenderPeriod?.startDate ?? release.date);
	const documentUrl = primaryDocumentUrl(tender, release);
	const portalUrl = noticeUrl(release);
	const method = category(tender);
	const contact = buyer?.contactPoint;
	const classification = cleanText(tender.classification?.description);
	const description = cleanText(tender.description ?? release.description);
	const lotDescriptions = (tender.lots ?? [])
		.map((lot) => cleanText(lot.description ?? lot.title))
		.filter(Boolean)
		.slice(0, 3);

	return {
		title,
		source: "find_tender",
		sourceId: `find-tender-${id}`,
		noticeId: id,
		organization,
		countryRegion: countryRegion(release),
		category: method,
		sector: classification || undefined,
		opportunityType: inferOpportunityType(tender),
		publishedDate,
		deadline,
		portalUrl,
		documentUrl,
		rfpLink: documentUrl,
		budgetNumeric: tender.value?.amount && tender.value.amount > 0 ? tender.value.amount : undefined,
		budgetCurrency: cleanText(tender.value?.currency) || undefined,
		budgetValue: valueSummary(tender.value),
		projectSummary: [
			description,
			lotDescriptions.length > 0 ? `Lots: ${lotDescriptions.join(" | ")}` : undefined,
			classification ? `CPV: ${classification}` : undefined,
			deadline ? `Submission deadline: ${deadline.toISOString()}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: cleanText([
			...(tender.submissionMethod ?? []),
			tender.submissionMethodDetails,
			contact?.email ? `Contact: ${contact.email}` : undefined,
			contact?.url,
		].filter(Boolean).join("; ")) || undefined,
		tags: ["find-tender", "uk", "public-procurement", "ocds", "source-api"],
		metadata: {
			findTender: {
				ocid: release.ocid ?? null,
				releaseId: release.id ?? null,
				tenderId: tender.id ?? null,
				status: tender.status ?? null,
				mainProcurementCategory: tender.mainProcurementCategory ?? null,
				procurementMethod: tender.procurementMethod ?? null,
				procurementMethodDetails: tender.procurementMethodDetails ?? null,
				classification: tender.classification ?? null,
				documents: (tender.documents ?? []).map((document) => ({
					id: document.id ?? null,
					title: document.title ?? document.description ?? null,
					type: document.documentType ?? null,
					url: document.url ?? null,
					format: document.format ?? null,
				})),
				links: (release.links ?? []).map((link) => ({
					rel: link.rel ?? null,
					href: link.href ?? null,
				})),
				contact: contact ? {
					name: contact.name ?? null,
					email: contact.email ?? null,
					telephone: contact.telephone ?? null,
					url: contact.url ?? null,
				} : null,
			},
		},
	};
}

export function parseFindTenderReleasePackage(
	payload: FindTenderReleasePackage,
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

async function fetchFindTenderReleases(sourceUrl: string): Promise<FindTenderReleasePackage> {
	let nextUrl: string | undefined = findTenderApiUrl(sourceUrl);
	const releases: FindTenderRelease[] = [];
	let lastResponse: FindTenderReleasePackage = {};

	for (let page = 0; nextUrl && page < maxApiPages(); page += 1) {
		const response = await fetch(nextUrl, {
			headers: {
				Accept: "application/json",
				"User-Agent": "DocFusionRfpSourceCollector/1.0",
			},
		});
		if (!response.ok) {
			throw new Error(`Find a Tender OCDS endpoint returned HTTP ${response.status}`);
		}
		const payload = await response.json() as FindTenderReleasePackage;
		lastResponse = payload;
		releases.push(...(payload.releases ?? []));
		nextUrl = payload.links?.next ?? undefined;
	}

	return {
		...lastResponse,
		releases,
	};
}

export const findTenderParser: TenderParser = {
	sourceId: "find_tender",
	name: "UK Find a Tender OCDS Releases",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = await fetchFindTenderReleases(input.url);
			return {
				opportunities: parseFindTenderReleasePackage(response),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch UK Find a Tender releases",
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

registerParser(findTenderParser);

export default findTenderParser;
