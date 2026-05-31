import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const CONTRACTS_FINDER_API_BASE_URL = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";
const CONTRACTS_FINDER_NOTICE_BASE_URL = "https://www.contractsfinder.service.gov.uk/Notice";
const DEFAULT_LIMIT = 100;
const DEFAULT_MAX_API_PAGES = 2;

type ContractsFinderValue = {
	amount?: number | null;
	currency?: string | null;
};

type ContractsFinderDocument = {
	id?: string | null;
	title?: string | null;
	description?: string | null;
	documentType?: string | null;
	url?: string | null;
	format?: string | null;
	datePublished?: string | null;
	dateModified?: string | null;
};

type ContractsFinderParty = {
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
	} | null;
};

type ContractsFinderTender = {
	id?: string | null;
	title?: string | null;
	status?: string | null;
	description?: string | null;
	datePublished?: string | null;
	mainProcurementCategory?: string | null;
	procurementMethod?: string | null;
	procurementMethodDetails?: string | null;
	classification?: {
		scheme?: string | null;
		id?: string | null;
		description?: string | null;
	} | null;
	additionalClassifications?: Array<{
		id?: string | null;
		description?: string | null;
	}> | null;
	value?: ContractsFinderValue | null;
	minValue?: ContractsFinderValue | null;
	documents?: ContractsFinderDocument[] | null;
	tenderPeriod?: {
		endDate?: string | null;
	} | null;
	contractPeriod?: {
		startDate?: string | null;
		endDate?: string | null;
		durationInDays?: number | null;
	} | null;
	items?: Array<{
		id?: string | null;
		deliveryAddresses?: Array<{
			region?: string | null;
			countryName?: string | null;
		}> | null;
	}> | null;
	suitability?: {
		sme?: boolean | null;
		vcse?: boolean | null;
	} | null;
};

type ContractsFinderRelease = {
	ocid?: string | null;
	id?: string | null;
	date?: string | null;
	tag?: string[] | null;
	description?: string | null;
	initiationType?: string | null;
	tender?: ContractsFinderTender | null;
	buyer?: {
		id?: string | null;
		name?: string | null;
	} | null;
	parties?: ContractsFinderParty[] | null;
	language?: string | null;
};

type ContractsFinderReleasePackage = {
	releases?: ContractsFinderRelease[] | null;
	links?: {
		next?: string | null;
	} | null;
};

type DocumentLink = {
	url: string;
	label?: string;
	format?: string;
	type?: string;
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

function contractsFinderApiUrl(sourceUrl = CONTRACTS_FINDER_API_BASE_URL): string {
	const url = new URL(sourceUrl || CONTRACTS_FINDER_API_BASE_URL, CONTRACTS_FINDER_API_BASE_URL);
	if (!url.pathname.includes("/Published/Notices/OCDS/Search")) {
		url.pathname = "/Published/Notices/OCDS/Search";
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
	const parsed = Number(process.env.CONTRACTS_FINDER_MAX_API_PAGES ?? DEFAULT_MAX_API_PAGES);
	if (!Number.isFinite(parsed)) return DEFAULT_MAX_API_PAGES;
	return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function noticeIdFromUrl(url: string | null | undefined): string | undefined {
	const text = cleanText(url);
	if (!text) return undefined;
	try {
		const parsed = new URL(text);
		const match = parsed.pathname.match(/\/Notice\/([0-9a-f-]{36})/i);
		return match?.[1];
	} catch {
		return undefined;
	}
}

function noticeIdFromRelease(release: ContractsFinderRelease): string | undefined {
	const documentNoticeId = (release.tender?.documents ?? [])
		.map((document) => noticeIdFromUrl(document.url))
		.find(Boolean);
	if (documentNoticeId) return documentNoticeId;

	const releaseId = cleanText(release.id);
	const match = releaseId.match(/^([0-9a-f-]{36})(?:-\d+)?$/i);
	if (match?.[1]) return match[1];

	return cleanText(release.ocid) || undefined;
}

function noticeUrl(release: ContractsFinderRelease): string {
	const noticeId = noticeIdFromRelease(release);
	return noticeId && /^[0-9a-f-]{36}$/i.test(noticeId)
		? `${CONTRACTS_FINDER_NOTICE_BASE_URL}/${noticeId}`
		: "https://www.contractsfinder.service.gov.uk/Search";
}

function buyerParty(release: ContractsFinderRelease): ContractsFinderParty | undefined {
	return (release.parties ?? []).find((party) => (party.roles ?? []).includes("buyer"));
}

function countryRegion(release: ContractsFinderRelease): string {
	const buyer = buyerParty(release);
	const buyerCountry = cleanText(buyer?.address?.countryName);
	if (buyerCountry) return buyerCountry === "UK" ? "United Kingdom" : buyerCountry;
	const deliveryCountry = (release.tender?.items ?? [])
		.flatMap((item) => item.deliveryAddresses ?? [])
		.map((address) => cleanText(address.countryName))
		.find(Boolean);
	if (deliveryCountry) return deliveryCountry === "UK" ? "United Kingdom" : deliveryCountry;
	const region = (release.tender?.items ?? [])
		.flatMap((item) => item.deliveryAddresses ?? [])
		.map((address) => cleanText(address.region))
		.find(Boolean);
	return region ? `United Kingdom - ${region}` : "United Kingdom";
}

function documentLinks(tender: ContractsFinderTender, release: ContractsFinderRelease): DocumentLink[] {
	const noticeUrlForRelease = noticeUrl(release);
	const links: DocumentLink[] = [];
	const seen = new Set<string>();

	for (const document of tender.documents ?? []) {
		const url = cleanText(document.url);
		if (!url || seen.has(url)) continue;
		seen.add(url);
		links.push({
			url,
			label: cleanText(document.title ?? document.description) || undefined,
			format: cleanText(document.format) || undefined,
			type: cleanText(document.documentType) || undefined,
		});
	}

	if (!seen.has(noticeUrlForRelease)) {
		links.unshift({
			url: noticeUrlForRelease,
			label: "Opportunity notice on Contracts Finder",
			format: "text/html",
			type: "tenderNotice",
		});
	}

	return links;
}

function primaryDocumentUrl(tender: ContractsFinderTender, release: ContractsFinderRelease): string {
	const links = documentLinks(tender, release);
	return links.find((link) => link.type !== "tenderNotice")?.url
		?? links[0]?.url
		?? noticeUrl(release);
}

function inferOpportunityType(tender: ContractsFinderTender): OpportunityData["opportunityType"] {
	const haystack = [
		tender.title,
		tender.description,
		tender.procurementMethod,
		tender.procurementMethodDetails,
		tender.classification?.description,
		...(tender.documents ?? []).map((document) => `${document.title ?? ""} ${document.description ?? ""} ${document.documentType ?? ""}`),
	].filter(Boolean).join(" ").toLowerCase();
	if (/\b(expression of interest|eoi|request for information|rfi|pre-qualification|prequalification)\b/.test(haystack)) return "eoi";
	if (/\b(request for proposal|rfp|proposal|consultancy|consulting)\b/.test(haystack)) return "rfp";
	if (/\bcontract\b/.test(haystack)) return "contract";
	return "tender";
}

function valueSummary(value: ContractsFinderValue | null | undefined): string | undefined {
	const amount = value?.amount;
	if (!amount || amount <= 0) return undefined;
	return `${cleanText(value?.currency) || "GBP"} ${amount}`;
}

function category(tender: ContractsFinderTender): string {
	return cleanText(tender.procurementMethodDetails)
		|| cleanText(tender.procurementMethod)
		|| cleanText(tender.mainProcurementCategory)
		|| "UK public procurement";
}

function isOpenTender(release: ContractsFinderRelease, deadline: Date | undefined, now: Date): boolean {
	const tender = release.tender;
	if (!tender) return false;
	const tags = (release.tag ?? []).map((tag) => tag.toLowerCase());
	if (tags.length > 0 && !tags.some((tag) => tag.includes("tender"))) return false;
	const status = cleanText(tender.status).toLowerCase();
	if (["cancelled", "canceled", "complete", "completed", "withdrawn", "unsuccessful"].includes(status)) {
		return false;
	}
	return !isExpired(deadline, now);
}

function opportunityFromRelease(release: ContractsFinderRelease, now: Date): OpportunityData | undefined {
	const tender = release.tender;
	if (!tender) return undefined;
	const noticeId = noticeIdFromRelease(release);
	if (!noticeId) return undefined;

	const deadline = parseIsoDate(tender.tenderPeriod?.endDate);
	if (!isOpenTender(release, deadline, now)) return undefined;

	const title = cleanText(tender.title);
	if (!title) return undefined;

	const buyer = buyerParty(release);
	const organization = cleanText(release.buyer?.name ?? buyer?.name) || "UK Contracts Finder";
	const publishedDate = parseIsoDate(tender.datePublished ?? release.date);
	const portalUrl = noticeUrl(release);
	const documents = documentLinks(tender, release);
	const documentUrl = primaryDocumentUrl(tender, release);
	const method = category(tender);
	const contact = buyer?.contactPoint;
	const classification = cleanText(tender.classification?.description);
	const additionalClassifications = (tender.additionalClassifications ?? [])
		.map((item) => cleanText(item.description))
		.filter(Boolean)
		.slice(0, 3);
	const description = cleanText(tender.description ?? release.description);

	return {
		title,
		source: "contracts_finder",
		sourceId: `contracts-finder-${noticeId}`,
		noticeId,
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
		budgetValue: valueSummary(tender.value ?? tender.minValue),
		projectSummary: [
			description,
			classification ? `CPV: ${classification}` : undefined,
			additionalClassifications.length > 0 ? `Additional CPV: ${additionalClassifications.join(" | ")}` : undefined,
			deadline ? `Submission deadline: ${deadline.toISOString()}` : undefined,
		].filter(Boolean).join("; "),
		submissionMethod: cleanText([
			contact?.email ? `Contact: ${contact.email}` : undefined,
			contact?.telephone ? `Telephone: ${contact.telephone}` : undefined,
			contact?.url,
		].filter(Boolean).join("; ")) || undefined,
		tags: ["contracts-finder", "uk", "public-procurement", "ocds", "source-api"],
		metadata: {
			contractsFinder: {
				ocid: release.ocid ?? null,
				releaseId: release.id ?? null,
				tenderId: tender.id ?? null,
				status: tender.status ?? null,
				mainProcurementCategory: tender.mainProcurementCategory ?? null,
				procurementMethod: tender.procurementMethod ?? null,
				procurementMethodDetails: tender.procurementMethodDetails ?? null,
				classification: tender.classification ?? null,
				additionalClassifications: tender.additionalClassifications ?? [],
				suitability: tender.suitability ?? null,
				documentLinks: documents,
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

export function parseContractsFinderReleasePackage(
	payload: ContractsFinderReleasePackage,
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

async function fetchContractsFinderReleases(sourceUrl: string): Promise<ContractsFinderReleasePackage> {
	let nextUrl: string | undefined = contractsFinderApiUrl(sourceUrl);
	const releases: ContractsFinderRelease[] = [];
	let lastResponse: ContractsFinderReleasePackage = {};

	for (let page = 0; nextUrl && page < maxApiPages(); page += 1) {
		const response = await fetch(nextUrl, {
			headers: {
				Accept: "application/json",
				"User-Agent": "DocFusionRfpSourceCollector/1.0",
			},
		});
		if (!response.ok) {
			throw new Error(`Contracts Finder OCDS endpoint returned HTTP ${response.status}`);
		}
		const payload = await response.json() as ContractsFinderReleasePackage;
		lastResponse = payload;
		releases.push(...(payload.releases ?? []));
		nextUrl = payload.links?.next ?? undefined;
	}

	return {
		...lastResponse,
		releases,
	};
}

export const contractsFinderParser: TenderParser = {
	sourceId: "contracts_finder",
	name: "UK Contracts Finder OCDS Notices",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const response = await fetchContractsFinderReleases(input.url);
			return {
				opportunities: parseContractsFinderReleasePackage(response),
			};
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : "Failed to fetch UK Contracts Finder notices",
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

registerParser(contractsFinderParser);

export default contractsFinderParser;
