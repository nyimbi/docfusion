import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const NIGER_BASE_URL = "https://www.marchespublics.ne";
export const MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL = `${NIGER_BASE_URL}/appels-offres`;

type NigerOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		marchesPublicsNiger: {
			sourceUrl: string;
			reference?: string;
			contractingAuthority?: string;
			sector?: string;
			procurementMethod?: string;
			marketType?: string;
			publishedDateText?: string;
			deadlineText?: string;
		};
	};
};

function decodeEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&deg;|&ordm;/gi, "\u00b0")
		.replace(/&eacute;/gi, "e")
		.replace(/&egrave;/gi, "e")
		.replace(/&ecirc;/gi, "e")
		.replace(/&agrave;/gi, "a")
		.replace(/&ccedil;/gi, "c")
		.replace(/&ocirc;/gi, "o")
		.replace(/&ucirc;/gi, "u")
		.replace(/&ndash;|&mdash;/gi, "-");
}

function stripHtml(value: string | undefined): string {
	if (!value) return "";
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function attrValue(attributes: string | undefined, name: string): string | undefined {
	const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attributes ?? "");
	return match?.[1] ? decodeEntities(match[1]).trim() : undefined;
}

function absoluteNigerUrl(rawUrl: string | undefined, sourceUrl = MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned) || /^mailto:/i.test(cleaned)) return undefined;
	try {
		const url = new URL(cleaned, sourceUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
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

function fieldValue(blockHtml: string, labelPattern: RegExp): string | undefined {
	for (const match of blockHtml.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>\s*([^<]*)/gi)) {
		if (!labelPattern.test(stripHtml(match[1]))) continue;
		const value = cleanFieldValue(stripHtml(match[2]));
		if (value) return value;
	}
	const labelSource = labelPattern.source.replace(/^\^/, "");
	const textMatch = new RegExp(`${labelSource}(.*?)(?=\\s+(?:Avis\\s*N[\\u00b0\\u00ba]|Date\\s+de\\s+publication|Date\\s+de\\s+cl[o\\u00f4]ture|Autorit[e\\u00e9]\\s+contractante|Secteur\\s+d.?activit[e\\u00e9]|Mode\\s+de\\s+passation|Type\\s+de\\s+march[e\\u00e9])\\s*:|$)`, "i")
		.exec(stripHtml(blockHtml));
	if (textMatch?.[1]) return cleanFieldValue(textMatch[1]);
	for (const match of blockHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
		const raw = match[1] ?? "";
		const text = stripHtml(raw);
		if (!labelPattern.test(text)) continue;
		return cleanFieldValue(text.replace(labelPattern, ""));
	}
	return undefined;
}

function cleanFieldValue(value: string | undefined): string | undefined {
	const cleaned = cleanText((value ?? "")
		.replace(/\bConsulter\s+l['\u2019]?avis\b.*$/i, "")
		.replace(/\s*<hr>\s*/gi, " "));
	return cleaned || undefined;
}

function parseNigerDate(value: string | undefined): Date | undefined {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(stripHtml(value));
	if (!match) return undefined;
	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	if (day < 1 || month < 1 || month > 12 || year < 2000) return undefined;
	return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function inferCategory(sector: string | undefined, marketType: string | undefined, procurementMethod: string | undefined): string {
	const text = `${sector ?? ""} ${marketType ?? ""} ${procurementMethod ?? ""}`.toLowerCase();
	if (/manifestation|inter[e\u00ea]t|prestations? intellectuelles?|consultant/.test(text)) return "Consulting services";
	if (/fournitures?|biens|mat[\u00e9e]riels?|equipement/.test(text)) return "Goods";
	if (/travaux|construction|installation/.test(text)) return "Works";
	return "Public procurement";
}

function inferOpportunityType(
	title: string,
	sector: string | undefined,
	marketType: string | undefined,
	procurementMethod: string | undefined
): OpportunityData["opportunityType"] {
	const text = `${title} ${sector ?? ""} ${marketType ?? ""} ${procurementMethod ?? ""}`.toLowerCase();
	if (/manifestation|expression d.?inter[e\u00ea]t|\beoi\b/.test(text)) return "eoi";
	if (/prestations? intellectuelles?|consultant|consultance|rfp|request for proposals?/.test(text)) return "rfp";
	return "tender";
}

function sourceIdFrom(reference: string | undefined, portalUrl: string, title: string): string {
	const identity = reference || (() => {
		try {
			const parts = new URL(portalUrl).pathname.split("/").filter(Boolean);
			return parts[1] || parts.at(-1) || title;
		} catch {
			return title;
		}
	})();
	return `marches-publics-niger-${slugify(identity) || "notice"}`;
}

function opportunityFromBlock(blockHtml: string, sourceUrl: string): NigerOpportunity | undefined {
	const titleLink = /<h2\b[^>]*class=["'][^"']*\btitre\b[^"']*["'][^>]*>\s*<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(blockHtml);
	const portalUrl = absoluteNigerUrl(attrValue(titleLink?.[1], "href"), sourceUrl);
	const title = stripHtml(titleLink?.[2]);
	if (!title || !portalUrl) return undefined;

	const reference = fieldValue(blockHtml, /^Avis\s*N[\u00b0\u00ba]\s*:\s*/i);
	const publishedDateText = fieldValue(blockHtml, /^Date\s+de\s+publication\s*:\s*/i);
	const contractingAuthority = fieldValue(blockHtml, /^Autorit[e\u00e9]\s+contractante\s*:\s*/i);
	const sector = fieldValue(blockHtml, /^Secteur\s+d.?activit[e\u00e9]\s*:\s*/i);
	const procurementMethod = fieldValue(blockHtml, /^Mode\s+de\s+passation\s*:\s*/i);
	const marketType = fieldValue(blockHtml, /^Type\s+de\s+march[e\u00e9]\s*:\s*/i);
	const deadlineText = stripHtml(/<span\b[^>]*class=["'][^"']*\bdate-response\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(blockHtml)?.[1]);
	const category = inferCategory(sector, marketType, procurementMethod);
	const opportunityType = inferOpportunityType(title, sector, marketType, procurementMethod);

	return {
		title,
		source: "marches_publics_niger",
		sourceId: sourceIdFrom(reference, portalUrl, title),
		noticeId: reference,
		organization: contractingAuthority || "Portail des Marches Publics du Niger",
		countryRegion: "Niger",
		category,
		opportunityType,
		publishedDate: parseNigerDate(publishedDateText),
		deadline: parseNigerDate(deadlineText),
		portalUrl,
		documentUrl: portalUrl,
		rfpLink: portalUrl,
		projectSummary: [
			reference ? `Avis No: ${reference}.` : undefined,
			contractingAuthority ? `Autorite contractante: ${contractingAuthority}.` : undefined,
			sector ? `Secteur: ${sector}.` : undefined,
			procurementMethod ? `Mode de passation: ${procurementMethod}.` : undefined,
			marketType ? `Type de marche: ${marketType}.` : undefined,
		].filter(Boolean).join(" ") || "Niger public procurement notice.",
		submissionMethod: "Use the Niger public procurement notice for tender documents and submission instructions.",
		tags: ["niger", "national-procurement", "west-africa", "source-api"],
		metadata: {
			marchesPublicsNiger: {
				sourceUrl,
				reference,
				contractingAuthority,
				sector,
				procurementMethod,
				marketType,
				publishedDateText,
				deadlineText: deadlineText || undefined,
			},
		},
	};
}

export function parseMarchesPublicsNigerHtml(
	html: string,
	sourceUrl = MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL
): NigerOpportunity[] {
	const blocks = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bcontentListeOffres\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bcontentListeOffres\b|$)/gi)]
		.map((match) => match[0] ?? "");
	const seen = new Set<string>();
	const opportunities: NigerOpportunity[] = [];
	for (const block of blocks) {
		const opportunity = opportunityFromBlock(block, sourceUrl);
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.portalUrl)) continue;
		seen.add(opportunity.sourceId ?? opportunity.portalUrl);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchNigerOpportunities(sourceUrl: string): Promise<NigerOpportunity[]> {
	const response = await fetch(sourceUrl || MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
		},
	});
	if (!response.ok) {
		throw new Error(`Niger public procurement fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseMarchesPublicsNigerHtml(await response.text(), sourceUrl);
}

export const marchesPublicsNigerParser: TenderParser = {
	sourceId: "marches_publics_niger",
	name: "Niger Public Procurement Portal",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			if (input.html || input.markdown) {
				return {
					opportunities: parseMarchesPublicsNigerHtml(input.html || input.markdown || "", input.url),
				};
			}
			return { opportunities: await fetchNigerOpportunities(input.url || MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || MARCHES_PUBLICS_NIGER_APPELS_OFFRES_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(marchesPublicsNigerParser);

export default marchesPublicsNigerParser;
