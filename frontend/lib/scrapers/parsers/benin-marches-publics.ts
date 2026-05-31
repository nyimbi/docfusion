import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

export const BENIN_MARCHES_PUBLICS_API_URL = "https://api.marches-publics.bj/v2/api/portail/appelsoffres?page=0&size=100&search=&status=0";
export const BENIN_MARCHES_PUBLICS_PORTAL_URL = "https://marches-publics.bj/appels-doffres";

type BeninTypeMarche = {
	code?: unknown;
	description?: unknown;
	libelle?: unknown;
};

type BeninRecord = {
	dosID?: unknown;
	dosReference?: unknown;
	dosDateCreation?: unknown;
	dosDateLimiteDepot?: unknown;
	dosDatePublication?: unknown;
	dosFichier?: unknown;
	dosHeurelimitedepot?: unknown;
	doslieuacquisitiondao?: unknown;
	dosLieuDepotDossier?: unknown;
	dosLieuOuvertureDesPlis?: unknown;
	dosLotDivisible?: unknown;
	dosNombreLots?: unknown;
	dayLeft?: unknown;
	expired?: unknown;
	appelsoffres?: {
		apoID?: unknown;
		apoObjet?: unknown;
		apoReference?: unknown;
		typemarche?: BeninTypeMarche;
	};
	autoriteContractante?: {
		denomination?: unknown;
		sigle?: unknown;
		typeautorite?: {
			libelle?: unknown;
		};
	};
};

type BeninApiResponse = {
	content?: unknown;
	totalPages?: unknown;
	totalElements?: unknown;
	number?: unknown;
	size?: unknown;
};

type BeninOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		beninMarchesPublics: {
			sourceUrl: string;
			dosID?: number | string;
			apoID?: number | string;
			reference?: string;
			typeCode?: string;
			typeDescription?: string;
			authoritySigle?: string;
			authorityType?: string;
			dayLeft?: number;
			expired?: boolean;
			directPdf?: string;
			totalLots?: number;
			acquisitionLocation?: string;
			depositLocation?: string;
			openingLocation?: string;
		};
	};
};

function asString(value: unknown): string | undefined {
	if (typeof value !== "string" && typeof value !== "number") return undefined;
	const cleaned = cleanText(String(value));
	return cleaned || undefined;
}

function asNumber(value: unknown): number | undefined {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		if (/^true$/i.test(value)) return true;
		if (/^false$/i.test(value)) return false;
	}
	return undefined;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
}

function safeUrl(value: unknown): string | undefined {
	const raw = asString(value);
	if (!raw || /^javascript:/i.test(raw) || /^mailto:/i.test(raw)) return undefined;
	try {
		const url = new URL(raw);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
}

function parseBeninDate(dateValue: unknown, timeValue?: unknown): Date | undefined {
	const dateText = asString(dateValue);
	if (!dateText) return undefined;
	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateText);
	if (!dateMatch) return undefined;
	const year = Number(dateMatch[1]);
	const month = Number(dateMatch[2]);
	const day = Number(dateMatch[3]);
	if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
	const timeText = asString(timeValue);
	const timeMatch = timeText ? /^(\d{1,2}):(\d{2})/.exec(timeText) : undefined;
	const hour = timeMatch ? Math.min(23, Number(timeMatch[1])) : 12;
	const minute = timeMatch ? Math.min(59, Number(timeMatch[2])) : 0;
	return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

function inferCategory(typeCode: string | undefined, typeDescription: string | undefined, title: string): string {
	const text = `${typeCode ?? ""} ${typeDescription ?? ""} ${title}`.toLowerCase();
	if (/\bpi\b|prestations? intellectuelles?|consultant|audit|etude|cabinet/.test(text)) return "Consulting services";
	if (/\bf\b|fournitures?|equipement|materiel|acquisition/.test(text)) return "Goods";
	if (/\bt\b|travaux|construction|rehabilitation|forage|installation/.test(text)) return "Works";
	if (/service/.test(text)) return "Services";
	return "Public procurement";
}

function inferOpportunityType(typeCode: string | undefined, typeDescription: string | undefined, title: string): OpportunityData["opportunityType"] {
	const text = `${typeCode ?? ""} ${typeDescription ?? ""} ${title}`.toLowerCase();
	if (/manifestation|expression d.?inter[eê]t|\beoi\b/.test(text)) return "eoi";
	if (/\bpi\b|prestations? intellectuelles?|consultant|cabinet|audit|etude|request for proposals?|\brfp\b/.test(text)) return "rfp";
	return "tender";
}

function sourceIdFrom(record: BeninRecord, reference: string | undefined, title: string): string {
	const dosID = asString(record.dosID);
	const identity = dosID && reference ? `${dosID}-${reference}` : dosID || reference || asString(record.appelsoffres?.apoID) || title;
	return `benin-marches-publics-${slugify(identity) || "notice"}`;
}

function opportunityFromRecord(record: BeninRecord, sourceUrl: string): BeninOpportunity | undefined {
	const title = asString(record.appelsoffres?.apoObjet);
	if (!title) return undefined;

	const reference = asString(record.dosReference) || asString(record.appelsoffres?.apoReference);
	const authority = asString(record.autoriteContractante?.denomination);
	const authoritySigle = asString(record.autoriteContractante?.sigle);
	const authorityType = asString(record.autoriteContractante?.typeautorite?.libelle);
	const typeCode = asString(record.appelsoffres?.typemarche?.code);
	const typeDescription = asString(record.appelsoffres?.typemarche?.description)
		|| asString(record.appelsoffres?.typemarche?.libelle);
	const directPdf = safeUrl(record.dosFichier);
	const portalUrl = `${BENIN_MARCHES_PUBLICS_PORTAL_URL}?notice=${encodeURIComponent(asString(record.dosID) || reference || title)}`;
	const acquisitionLocation = asString(record.doslieuacquisitiondao);
	const depositLocation = asString(record.dosLieuDepotDossier);
	const openingLocation = asString(record.dosLieuOuvertureDesPlis);
	const totalLots = asNumber(record.dosNombreLots);

	return {
		title,
		source: "benin_marches_publics",
		sourceId: sourceIdFrom(record, reference, title),
		noticeId: reference,
		organization: authority || authoritySigle || "Benin Public Procurement Portal",
		countryRegion: "Benin",
		category: inferCategory(typeCode, typeDescription, title),
		opportunityType: inferOpportunityType(typeCode, typeDescription, title),
		publishedDate: parseBeninDate(record.dosDatePublication) || parseBeninDate(record.dosDateCreation),
		deadline: parseBeninDate(record.dosDateLimiteDepot, record.dosHeurelimitedepot),
		portalUrl,
		documentUrl: directPdf || portalUrl,
		rfpLink: directPdf || portalUrl,
		projectSummary: [
			reference ? `Reference: ${reference}.` : undefined,
			authority ? `Autorite contractante: ${authority}.` : undefined,
			authorityType ? `Type d'autorite: ${authorityType}.` : undefined,
			typeDescription ? `Type de marche: ${typeDescription}.` : undefined,
			totalLots ? `Lots: ${totalLots}.` : undefined,
		].filter(Boolean).join(" ") || "Benin public procurement notice.",
		submissionMethod: [
			asString(record.dosDateLimiteDepot) ? `Deadline: ${asString(record.dosDateLimiteDepot)}${asString(record.dosHeurelimitedepot) ? ` ${asString(record.dosHeurelimitedepot)}` : ""}.` : undefined,
			acquisitionLocation ? `DAO acquisition: ${acquisitionLocation}.` : undefined,
			depositLocation ? `Deposit location: ${depositLocation}.` : undefined,
			openingLocation ? `Opening location: ${openingLocation}.` : undefined,
		].filter(Boolean).join(" ") || "Use the Benin public procurement notice for submission instructions.",
		tags: ["benin", "national-procurement", "west-africa", "source-api", ...(directPdf ? ["direct-documents"] : [])],
		metadata: {
			beninMarchesPublics: {
				sourceUrl,
				dosID: asNumber(record.dosID) ?? asString(record.dosID),
				apoID: asNumber(record.appelsoffres?.apoID) ?? asString(record.appelsoffres?.apoID),
				reference,
				typeCode,
				typeDescription,
				authoritySigle,
				authorityType,
				dayLeft: asNumber(record.dayLeft),
				expired: asBoolean(record.expired),
				directPdf,
				totalLots,
				acquisitionLocation,
				depositLocation,
				openingLocation,
			},
		},
	};
}

function recordsFromResponse(value: unknown): BeninRecord[] {
	if (!value || typeof value !== "object") return [];
	const response = value as BeninApiResponse;
	return Array.isArray(response.content) ? response.content.filter((item): item is BeninRecord => Boolean(item && typeof item === "object")) : [];
}

export function parseBeninMarchesPublicsJson(
	json: string | BeninApiResponse,
	sourceUrl = BENIN_MARCHES_PUBLICS_API_URL
): BeninOpportunity[] {
	const parsed = typeof json === "string" ? JSON.parse(json) as BeninApiResponse : json;
	const seen = new Set<string>();
	const opportunities: BeninOpportunity[] = [];
	for (const record of recordsFromResponse(parsed)) {
		const opportunity = opportunityFromRecord(record, sourceUrl);
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.portalUrl)) continue;
		seen.add(opportunity.sourceId ?? opportunity.portalUrl);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchJson(url: string): Promise<BeninApiResponse> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "application/json",
			"Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
		},
	});
	if (!response.ok) {
		throw new Error(`Benin public procurement fetch failed: ${response.status} ${response.statusText}`);
	}
	return await response.json() as BeninApiResponse;
}

function apiUrlFromSource(sourceUrl: string): URL {
	try {
		const url = new URL(sourceUrl || BENIN_MARCHES_PUBLICS_API_URL);
		if (url.hostname === "api.marches-publics.bj" && url.pathname.startsWith("/v2/api/portail/appelsoffres")) {
			return url;
		}
	} catch {
		// Fall back to the known JSON endpoint below.
	}
	return new URL(BENIN_MARCHES_PUBLICS_API_URL);
}

async function fetchBeninOpportunities(sourceUrl: string): Promise<BeninOpportunity[]> {
	const firstUrl = apiUrlFromSource(sourceUrl);
	if (!firstUrl.searchParams.has("page")) firstUrl.searchParams.set("page", "0");
	if (!firstUrl.searchParams.has("size")) firstUrl.searchParams.set("size", "100");
	if (!firstUrl.searchParams.has("search")) firstUrl.searchParams.set("search", "");
	if (!firstUrl.searchParams.has("status")) firstUrl.searchParams.set("status", "0");

	const firstResponse = await fetchJson(firstUrl.toString());
	const totalPages = Math.min(10, Math.max(1, asNumber(firstResponse.totalPages) ?? 1));
	const seen = new Set<string>();
	const opportunities: BeninOpportunity[] = [];

	for (const opportunity of parseBeninMarchesPublicsJson(firstResponse, firstUrl.toString())) {
		if (seen.has(opportunity.sourceId ?? opportunity.portalUrl)) continue;
		seen.add(opportunity.sourceId ?? opportunity.portalUrl);
		opportunities.push(opportunity);
	}

	for (let page = 1; page < totalPages; page += 1) {
		const pageUrl = new URL(firstUrl);
		pageUrl.searchParams.set("page", String(page));
		for (const opportunity of parseBeninMarchesPublicsJson(await fetchJson(pageUrl.toString()), pageUrl.toString())) {
			if (seen.has(opportunity.sourceId ?? opportunity.portalUrl)) continue;
			seen.add(opportunity.sourceId ?? opportunity.portalUrl);
			opportunities.push(opportunity);
		}
	}

	return opportunities;
}

export const beninMarchesPublicsParser: TenderParser = {
	sourceId: "benin_marches_publics",
	name: "Benin Public Procurement Portal",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			const content = input.html || input.markdown;
			if (content?.trim().startsWith("{")) {
				return {
					opportunities: parseBeninMarchesPublicsJson(content, input.url),
				};
			}
			return { opportunities: await fetchBeninOpportunities(input.url || BENIN_MARCHES_PUBLICS_API_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || BENIN_MARCHES_PUBLICS_API_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(beninMarchesPublicsParser);

export default beninMarchesPublicsParser;
