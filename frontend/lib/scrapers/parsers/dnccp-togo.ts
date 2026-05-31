import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const DNCCP_TOGO_BASE_URL = "https://dnccp.gouv.tg/dnccp";
export const DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL = `${DNCCP_TOGO_BASE_URL}/wp-json/wp/v2/posts?categories=45%2C104%2C105%2C106&per_page=100&_fields=id%2Cdate%2Clink%2Ctitle%2Ccontent%2Cexcerpt%2Ccategories`;
export const DNCCP_TOGO_AVIS_APPEL_OFFRES_URL = `${DNCCP_TOGO_BASE_URL}/category/avis-d-appel-d-offres/`;

type WpRendered = {
	rendered?: string;
};

type DnccpTogoPost = {
	id?: number;
	date?: string;
	link?: string;
	title?: WpRendered;
	content?: WpRendered;
	excerpt?: WpRendered;
	categories?: number[];
};

type DnccpTogoDocumentLink = {
	label?: string;
	url: string;
};

type DnccpTogoOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		dnccpTogo: {
			postId?: number;
			sourceUrl: string;
			categories: number[];
			documentLinks: DnccpTogoDocumentLink[];
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
		.replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&eacute;/gi, "e")
		.replace(/&egrave;/gi, "e")
		.replace(/&ecirc;/gi, "e")
		.replace(/&agrave;/gi, "a")
		.replace(/&ccedil;/gi, "c")
		.replace(/&ocirc;/gi, "o")
		.replace(/&ucirc;/gi, "u")
		.replace(/&deg;|&#176;/gi, " deg ")
		.replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, "-");
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

function absoluteTogoUrl(rawUrl: string | undefined, sourceUrl = DNCCP_TOGO_BASE_URL): string | undefined {
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

function parseWpDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const parsed = new Date(value.endsWith("Z") ? value : `${value}Z`);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isProcurementDocumentUrl(url: string): boolean {
	try {
		const pathname = decodeURIComponent(new URL(url).pathname).toLowerCase();
		return /\.(?:pdf|docx?|xlsx?)(?:$|[?#])/.test(pathname)
			&& !/\/elementor\/|\/css\/|font|logo|capture|couverture|\.(?:png|jpe?g|gif|webp|svg)(?:$|[?#])/.test(pathname);
	} catch {
		return false;
	}
}

function collectDocumentLinks(html: string | undefined, sourceUrl: string): DnccpTogoDocumentLink[] {
	const links: DnccpTogoDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of html?.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi) ?? []) {
		const url = absoluteTogoUrl(attrValue(match[1], "href"), sourceUrl);
		if (!url || seen.has(url) || !isProcurementDocumentUrl(url)) continue;
		seen.add(url);
		links.push({
			label: stripHtml(match[2]) || url.split("/").pop() || undefined,
			url,
		});
	}

	for (const match of html?.matchAll(/https?:\/\/[^\s<>"')]+/g) ?? []) {
		const url = absoluteTogoUrl(match[0], sourceUrl);
		if (!url || seen.has(url) || !isProcurementDocumentUrl(url)) continue;
		seen.add(url);
		links.push({ url });
	}
	return links;
}

function inferCategory(title: string, categories: number[]): string {
	const text = title.toLowerCase();
	if (categories.includes(104) || /consultant|prestation intellectuelle|assistance|audit|etude|etudes|formation/.test(text)) return "Consulting services";
	if (/travaux|rehabilitation|construction|amenagement|infrastructures?/.test(text)) return "Works";
	if (/fourniture|acquisition|materiels?|equipements?|vehicules?|mobiliers?/.test(text)) return "Goods";
	if (categories.includes(106) || /delegation|concession|dsp/.test(text)) return "Delegated public service";
	return "Public procurement";
}

function inferOpportunityType(title: string, categories: number[]): OpportunityData["opportunityType"] {
	const text = title.toLowerCase();
	if (/manifestation|expression d.?inter[eê]t|\bami\b/.test(text)) return "eoi";
	if (categories.includes(104) || /consultant|prestation intellectuelle|assistance|audit|etude|etudes|\brfp\b|request for proposals?/.test(text)) return "rfp";
	return "tender";
}

function humanizeDocumentFilename(documentUrl: string | undefined): string | undefined {
	if (!documentUrl) return undefined;
	try {
		const filename = decodeURIComponent(new URL(documentUrl).pathname.split("/").filter(Boolean).pop() ?? "")
			.replace(/\.[a-z0-9]+$/i, "")
			.replace(/[_-]+/g, " ");
		return cleanText(filename) || undefined;
	} catch {
		return undefined;
	}
}

function contentProcurementTitle(contentText: string): string | undefined {
	const cleaned = cleanText(contentText.replace(/\b(?:Telechargement|Téléchargement)\b/gi, " "));
	const match = /\bAvis\b[^.]{20,260}(?:\.|$)/i.exec(cleaned)
		?? /\b(?:DAO|AMI|AOO|DRP|TDR)\b[^.]{20,220}(?:\.|$)/i.exec(cleaned);
	return match?.[0] ? cleanText(match[0]) : undefined;
}

function titleFromPost(post: DnccpTogoPost, documentUrl: string | undefined): string {
	const rawTitle = stripHtml(post.title?.rendered);
	if (rawTitle.length >= 20) return rawTitle;
	const contentTitle = contentProcurementTitle(stripHtml(post.content?.rendered));
	if (contentTitle) return contentTitle;
	return humanizeDocumentFilename(documentUrl) ?? rawTitle;
}

function sourceIdFrom(post: DnccpTogoPost, portalUrl: string, documentUrl: string | undefined, title: string): string {
	if (post.id) return `dnccp-togo-${post.id}`;
	for (const url of [documentUrl, portalUrl]) {
		try {
			const leaf = new URL(url ?? "").pathname.split("/").filter(Boolean).pop();
			if (leaf) return `dnccp-togo-${slugify(leaf.replace(/\.[a-z0-9]+$/i, "")) || "notice"}`;
		} catch {
			// Fall through to title.
		}
	}
	return `dnccp-togo-${slugify(title) || "notice"}`;
}

function opportunityFromPost(post: DnccpTogoPost, sourceUrl: string): DnccpTogoOpportunity | undefined {
	const portalUrl = absoluteTogoUrl(post.link, DNCCP_TOGO_BASE_URL);
	const categories = post.categories ?? [];
	if (!portalUrl) return undefined;
	const documentLinks = collectDocumentLinks(post.content?.rendered, portalUrl);
	const primaryDocument = documentLinks[0];
	const title = titleFromPost(post, primaryDocument?.url);
	if (!title) return undefined;

	const excerpt = stripHtml(post.excerpt?.rendered || post.content?.rendered);
	return {
		title,
		source: "dnccp_togo",
		sourceId: sourceIdFrom(post, portalUrl, primaryDocument?.url, title),
		noticeId: post.id ? String(post.id) : undefined,
		organization: "Direction Nationale du Controle de la Commande Publique du Togo",
		countryRegion: "Togo",
		category: inferCategory(title, categories),
		opportunityType: inferOpportunityType(title, categories),
		publishedDate: parseWpDate(post.date),
		portalUrl,
		documentUrl: primaryDocument?.url ?? portalUrl,
		rfpLink: primaryDocument?.url ?? portalUrl,
		projectSummary: [
			excerpt ? `${excerpt}.` : undefined,
			documentLinks.length > 0 ? `${documentLinks.length} linked procurement document(s) found.` : undefined,
		].filter(Boolean).join(" ") || "Togo DNCCP procurement notice.",
		submissionMethod: "Use the DNCCP notice and linked procurement document for submission instructions.",
		tags: [
			"togo",
			"west-africa",
			"national-procurement",
			"source-api",
			...(documentLinks.length > 0 ? ["direct-documents"] : []),
		],
		metadata: {
			dnccpTogo: {
				postId: post.id,
				sourceUrl,
				categories,
				documentLinks,
			},
		},
	};
}

function parsePostsPayload(payload: string | DnccpTogoPost[]): DnccpTogoPost[] {
	if (Array.isArray(payload)) return payload;
	const parsed = JSON.parse(payload) as unknown;
	return Array.isArray(parsed) ? parsed as DnccpTogoPost[] : [];
}

export function parseDnccpTogoPostsPayload(
	payload: string | DnccpTogoPost[],
	sourceUrl = DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL
): DnccpTogoOpportunity[] {
	const seen = new Set<string>();
	const opportunities: DnccpTogoOpportunity[] = [];
	for (const post of parsePostsPayload(payload)) {
		const opportunity = opportunityFromPost(post, sourceUrl);
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.title)) continue;
		seen.add(opportunity.sourceId ?? opportunity.title);
		opportunities.push(opportunity);
	}
	return opportunities;
}

function apiUrlFor(sourceUrl: string): string {
	if (/\/wp-json\/wp\/v2\/posts/i.test(sourceUrl)) return sourceUrl;
	return DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL;
}

async function fetchDnccpTogoOpportunities(sourceUrl: string): Promise<DnccpTogoOpportunity[]> {
	const apiUrl = apiUrlFor(sourceUrl || DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL);
	const response = await fetch(apiUrl, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "application/json,text/plain,*/*",
			"Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
		},
	});
	if (!response.ok) {
		throw new Error(`DNCCP Togo fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseDnccpTogoPostsPayload(await response.text(), apiUrl);
}

export const dnccpTogoParser: TenderParser = {
	sourceId: "dnccp_togo",
	name: "DNCCP Togo",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		try {
			if (input.html || input.markdown) {
				return {
					opportunities: parseDnccpTogoPostsPayload(input.html || input.markdown || "", input.url),
				};
			}
			return { opportunities: await fetchDnccpTogoOpportunities(input.url || DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL) };
		} catch (error) {
			return {
				opportunities: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},

	getPageUrl(baseUrl: string): string {
		return baseUrl || DNCCP_TOGO_AVIS_APPEL_OFFRES_API_URL;
	},

	hasNextPage(): boolean {
		return false;
	},
};

registerParser(dnccpTogoParser);

export default dnccpTogoParser;
