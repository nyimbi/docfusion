import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const DGMP_MALI_BASE_URL = "https://www.dgmp.gouv.ml";
export const DGMP_MALI_APPELS_OFFRES_URL = `${DGMP_MALI_BASE_URL}/?q=node/71`;
export const DGMP_MALI_AMI_URL = `${DGMP_MALI_BASE_URL}/?q=node/66`;

type DgmpMaliParseOptions = {
	currentYear?: number;
};

type DgmpMaliOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		dgmpMali: {
			sourceUrl: string;
			contractingAuthority?: string;
			serviceName?: string;
			documentDateText?: string;
			documentId?: string;
			sourceSection: "appel_offres" | "manifestation_interet";
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
		.replace(/&eacute;/gi, "e")
		.replace(/&egrave;/gi, "e")
		.replace(/&ecirc;/gi, "e")
		.replace(/&agrave;/gi, "a")
		.replace(/&ccedil;/gi, "c")
		.replace(/&ocirc;/gi, "o")
		.replace(/&ucirc;/gi, "u")
		.replace(/&ndash;|&mdash;|/gi, "-");
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

function absoluteMaliUrl(rawUrl: string | undefined, sourceUrl: string): string | undefined {
	const cleaned = decodeEntities(rawUrl ?? "").trim();
	if (!cleaned || /^javascript:/i.test(cleaned) || /^mailto:/i.test(cleaned)) return undefined;
	try {
		const url = new URL(cleaned, sourceUrl || DGMP_MALI_BASE_URL);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
}

function parseDgmpMaliDate(value: string | undefined): Date | undefined {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(stripHtml(value));
	if (!match) return undefined;
	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return undefined;
	return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
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

function sourceSection(sourceUrl: string): DgmpMaliOpportunity["metadata"]["dgmpMali"]["sourceSection"] {
	return /node\/66|q=node\/66/i.test(sourceUrl) ? "manifestation_interet" : "appel_offres";
}

function documentIdFrom(documentUrl: string | undefined, title: string, dateText: string | undefined): string {
	if (documentUrl) {
		try {
			const filename = new URL(documentUrl).pathname.split("/").filter(Boolean).at(-1);
			const stem = filename?.replace(/\.[a-z0-9]+$/i, "");
			if (stem) return slugify(stem);
		} catch {
			// Fall through to title/date identity.
		}
	}
	return slugify(`${dateText ?? ""}-${title}`) || "notice";
}

function inferCategory(title: string): string {
	const text = title.toLowerCase();
	if (/telecom|tic|informatique|systeme|système|plateforme|identification|logiciel|base de donnees|base de données/.test(text)) return "ICT services";
	if (/consultant|cabinet|audit|etude|etudes|assistance technique|controle|surveillance|architecture/.test(text)) return "Consulting services";
	if (/travaux|construction|rehabilitation|amenagement|ouvrage|batiment/.test(text)) return "Works";
	if (/fourniture|acquisition|equipement|materiel|consommables|vehicule|mobiliers?/.test(text)) return "Goods";
	if (/service|gardiennage|nettoyage|maintenance|restauration/.test(text)) return "Services";
	return "Public procurement";
}

function inferOpportunityType(
	title: string,
	section: DgmpMaliOpportunity["metadata"]["dgmpMali"]["sourceSection"]
): OpportunityData["opportunityType"] {
	const text = title.toLowerCase();
	if (section === "manifestation_interet") return /consultant|cabinet|audit|etude|etudes|assistance/.test(text) ? "rfp" : "eoi";
	if (/manifestation|expression d.?inter[eê]t|\bami\b/.test(text)) return "eoi";
	if (/consultant|cabinet|audit|etude|etudes|assistance technique|\brfp\b|request for proposals?/.test(text)) return "rfp";
	return "tender";
}

function tableCells(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1] ?? "");
}

function opportunityFromRow(
	rowHtml: string,
	sourceUrl: string,
	currentYear: number
): DgmpMaliOpportunity | undefined {
	const cells = tableCells(rowHtml);
	if (cells.length < 5) return undefined;

	const contractingAuthority = stripHtml(cells[0]);
	const serviceName = stripHtml(cells[1]);
	const title = stripHtml(cells[2]);
	const documentDateText = stripHtml(cells[3]);
	const publishedDate = parseDgmpMaliDate(documentDateText);
	if (!title || !publishedDate || publishedDate.getUTCFullYear() < currentYear) return undefined;

	const linkMatch = /<a\b([^>]*)>/i.exec(cells[4] ?? "");
	const documentUrl = absoluteMaliUrl(attrValue(linkMatch?.[1], "href"), sourceUrl);
	const section = sourceSection(sourceUrl);
	const documentId = documentIdFrom(documentUrl, title, documentDateText);

	return {
		title,
		source: "dgmp_mali",
		sourceId: `dgmp-mali-${documentId}`,
		noticeId: documentId,
		organization: contractingAuthority || serviceName || "Direction Generale des Marches Publics du Mali",
		countryRegion: "Mali",
		category: inferCategory(title),
		opportunityType: inferOpportunityType(title, section),
		publishedDate,
		portalUrl: sourceUrl,
		documentUrl: documentUrl || sourceUrl,
		rfpLink: documentUrl || sourceUrl,
		projectSummary: [
			contractingAuthority ? `Autorite contractante: ${contractingAuthority}.` : undefined,
			serviceName ? `Service: ${serviceName}.` : undefined,
			documentDateText ? `Date du dossier: ${documentDateText}.` : undefined,
		].filter(Boolean).join(" ") || "Mali public procurement notice.",
		submissionMethod: "Use the DGMP Mali source document for tender documents and submission instructions.",
		tags: [
			"mali",
			"national-procurement",
			"west-africa",
			"source-api",
			...(documentUrl ? ["direct-documents"] : []),
			...(section === "manifestation_interet" ? ["expression-of-interest"] : []),
		],
		metadata: {
			dgmpMali: {
				sourceUrl,
				contractingAuthority,
				serviceName,
				documentDateText,
				documentId,
				sourceSection: section,
			},
		},
	};
}

export function parseDgmpMaliHtml(
	html: string,
	sourceUrl = DGMP_MALI_APPELS_OFFRES_URL,
	options: DgmpMaliParseOptions = {}
): DgmpMaliOpportunity[] {
	const currentYear = options.currentYear ?? new Date().getUTCFullYear();
	const seen = new Set<string>();
	const opportunities: DgmpMaliOpportunity[] = [];
	for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const opportunity = opportunityFromRow(match[0] ?? "", sourceUrl, currentYear);
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.title)) continue;
		seen.add(opportunity.sourceId ?? opportunity.title);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchMaliOpportunities(sourceUrl: string): Promise<DgmpMaliOpportunity[]> {
	const response = await fetch(sourceUrl || DGMP_MALI_APPELS_OFFRES_URL, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
		},
	});
	if (!response.ok) {
		throw new Error(`DGMP Mali fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseDgmpMaliHtml(await response.text(), sourceUrl || DGMP_MALI_APPELS_OFFRES_URL);
}

export const dgmpMaliParser: TenderParser = {
	sourceId: "dgmp_mali",
	name: "DGMP Mali",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			if (input.html || input.markdown) {
				return {
					opportunities: parseDgmpMaliHtml(input.html || input.markdown || "", input.url),
				};
			}
			return { opportunities: await fetchMaliOpportunities(input.url || DGMP_MALI_APPELS_OFFRES_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || DGMP_MALI_APPELS_OFFRES_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(dgmpMaliParser);

export default dgmpMaliParser;
