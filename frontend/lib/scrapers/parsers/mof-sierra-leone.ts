import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const MOF_SIERRA_LEONE_BASE_URL = "https://mof.gov.sl";
export const MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL = `${MOF_SIERRA_LEONE_BASE_URL}/public-notices/`;

type MofSierraLeoneDocumentLink = {
	label?: string;
	url: string;
};

type MofSierraLeoneOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		mofSierraLeone: {
			addedOn?: string;
			sourceUrl: string;
			documentLinks: MofSierraLeoneDocumentLink[];
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

function absoluteMofUrl(rawUrl: string | undefined, sourceUrl = MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL): string | undefined {
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

function parseAddedOn(value: string | undefined): Date | undefined {
	const cleaned = stripHtml(value);
	if (!cleaned) return undefined;
	const explicit = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/.exec(cleaned);
	if (explicit) {
		const month = [
			"january",
			"february",
			"march",
			"april",
			"may",
			"june",
			"july",
			"august",
			"september",
			"october",
			"november",
			"december",
		].indexOf(explicit[1].toLowerCase());
		if (month >= 0) return new Date(Date.UTC(Number(explicit[3]), month, Number(explicit[2]), 12, 0, 0));
	}
	const parsed = new Date(cleaned);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function looksLikeProcurementNotice(title: string, documentUrl: string | undefined): boolean {
	const haystack = `${title} ${documentUrl ?? ""}`.toLowerCase();
	return /\b(?:spn|specific procurement notice|reoi|request for expressions? of interest|rfp|request for proposals?|bid|tender|procurement|consulting services?)\b/.test(haystack);
}

function isProcurementDocumentUrl(url: string): boolean {
	try {
		const pathname = decodeURIComponent(new URL(url).pathname).toLowerCase();
		return /\b(?:spn|specific-procurement|procurement|reoi|expression|rfp|request-for-proposal|bid|bidding|tender|tor|terms-of-reference|invitation|consulting|consultant|hiring)\b/.test(pathname);
	} catch {
		return false;
	}
}

function inferOpportunityType(title: string): OpportunityData["opportunityType"] {
	const normalized = title.toLowerCase();
	if (/\b(?:reoi|expression of interest)\b/.test(normalized)) return "eoi";
	if (/\b(?:spn|rfp|request for proposals?|consulting services?)\b/.test(normalized)) return "rfp";
	return "tender";
}

function inferCategory(title: string): string {
	const normalized = title.toLowerCase();
	if (/\b(?:reoi|expression of interest)\b/.test(normalized)) return "Request for expression of interest";
	if (/\b(?:spn|specific procurement notice|rfp|request for proposals?)\b/.test(normalized)) return "Request for proposal";
	if (/consulting services?/.test(normalized)) return "Consulting services";
	return "Public procurement notice";
}

function collectDocumentLinks(cellHtml: string, sourceUrl: string): MofSierraLeoneDocumentLink[] {
	const links: MofSierraLeoneDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of cellHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteMofUrl(attrValue(match[1], "href"), sourceUrl);
		if (!url || seen.has(url)) continue;
		if (!/\.(?:pdf|docx?|xlsx?)(?:$|[?#])/i.test(new URL(url).pathname)) continue;
		if (!isProcurementDocumentUrl(url)) continue;
		seen.add(url);
		links.push({
			label: stripHtml(match[2]) || url.split("/").pop() || undefined,
			url,
		});
	}
	return links;
}

function rowCells(rowHtml: string): string[] {
	return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1] ?? "");
}

function sourceIdFrom(portalUrl: string | undefined, documentUrl: string | undefined, title: string): string {
	const identity = (() => {
		for (const url of [documentUrl, portalUrl]) {
			try {
				const parsed = new URL(url ?? "");
				const leaf = parsed.pathname.split("/").filter(Boolean).pop();
				if (leaf) return leaf.replace(/\.[a-z0-9]+$/i, "");
			} catch {
				// Fall through to title.
			}
		}
		return title;
	})();
	return `mof-sierra-leone-${slugify(identity) || "notice"}`;
}

function opportunityFromRow(rowHtml: string, sourceUrl: string): MofSierraLeoneOpportunity | undefined {
	const cells = rowCells(rowHtml);
	if (cells.length < 4) return undefined;

	const portalMatch = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(cells[1] ?? "");
	const portalUrl = absoluteMofUrl(attrValue(portalMatch?.[1], "href"), sourceUrl);
	const title = stripHtml(portalMatch?.[2] ?? cells[1]);
	const addedOn = stripHtml(cells[2]);
	const documentLinks = collectDocumentLinks(cells[3] ?? "", sourceUrl);
	const primaryDocument = documentLinks[0];
	if (!title || !portalUrl || documentLinks.length === 0 || !looksLikeProcurementNotice(title, primaryDocument?.url)) return undefined;

	return {
		title,
		source: "mof_sierra_leone",
		sourceId: sourceIdFrom(portalUrl, primaryDocument?.url, title),
		organization: "Ministry of Finance, Sierra Leone",
		countryRegion: "Sierra Leone",
		category: inferCategory(title),
		opportunityType: inferOpportunityType(title),
		publishedDate: parseAddedOn(addedOn),
		portalUrl,
		documentUrl: primaryDocument?.url ?? portalUrl,
		rfpLink: primaryDocument?.url ?? portalUrl,
		projectSummary: [
			addedOn ? `Added on: ${addedOn}.` : undefined,
			documentLinks.length > 0 ? `${documentLinks.length} linked procurement document(s) found.` : undefined,
		].filter(Boolean).join(" ") || "Sierra Leone Ministry of Finance procurement notice.",
		submissionMethod: "Use the Ministry of Finance notice and linked procurement document for submission instructions.",
		tags: ["sierra-leone", "ministry-of-finance", "national-procurement", "source-documents"],
		metadata: {
			mofSierraLeone: {
				addedOn,
				sourceUrl,
				documentLinks,
			},
		},
	};
}

export function parseMofSierraLeonePublicNoticesHtml(
	html: string,
	sourceUrl = MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL
): MofSierraLeoneOpportunity[] {
	const rows = [...html.matchAll(/<tr\b[^>]*class=["'][^"']*\bpost-row\b[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)]
		.map((match) => match[0] ?? "");
	const seen = new Set<string>();
	const opportunities: MofSierraLeoneOpportunity[] = [];
	for (const row of rows) {
		const opportunity = opportunityFromRow(row, sourceUrl);
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.title)) continue;
		seen.add(opportunity.sourceId ?? opportunity.title);
		opportunities.push(opportunity);
	}
	return opportunities;
}

async function fetchMofSierraLeoneNotices(sourceUrl: string): Promise<MofSierraLeoneOpportunity[]> {
	const response = await fetch(sourceUrl || MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL, {
		signal: AbortSignal.timeout(20000),
		headers: {
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
		},
	});
	if (!response.ok) {
		throw new Error(`Sierra Leone MoF public notices fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseMofSierraLeonePublicNoticesHtml(await response.text(), sourceUrl);
}

export const mofSierraLeoneParser: TenderParser = {
	sourceId: "mof_sierra_leone",
	name: "Sierra Leone Ministry of Finance Public Notices",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			if (input.html || input.markdown) {
				return {
					opportunities: parseMofSierraLeonePublicNoticesHtml(
						input.html || input.markdown || "",
						input.url
					),
				};
			}
			return { opportunities: await fetchMofSierraLeoneNotices(input.url || MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || MOF_SIERRA_LEONE_PUBLIC_NOTICES_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(mofSierraLeoneParser);
