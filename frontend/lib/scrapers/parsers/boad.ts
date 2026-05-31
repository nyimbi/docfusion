import type { OpportunityData } from "../deduplicator";
import type { ParseInput, ParseResult, TenderParser } from "./types";
import { cleanText, registerParser } from "./types";

const BOAD_BASE_URL = "https://www.boad.org";
export const BOAD_TENDERS_URL = `${BOAD_BASE_URL}/fr/opportunites/appels-doffre`;
const DEFAULT_PAGE_LIMIT = 10;
const DEFAULT_DETAIL_LIMIT = 25;

type BoadDocumentLink = {
	label?: string;
	url: string;
};

type BoadMetadata = {
	reference?: string;
	deadlineText?: string;
	publishedText?: string;
	detailUrl: string;
	documentLinks: BoadDocumentLink[];
};

type BoadOpportunity = OpportunityData & {
	portalUrl: string;
	metadata: {
		boad: BoadMetadata;
	};
};

type BoadTenderRow = {
	id?: number | string;
	external_id?: number | string;
	link?: string;
	slug?: string;
	title?: string;
	type?: string;
	acf?: {
		presentation?: {
			title?: string | null;
			text?: string | null;
		} | null;
		start_at?: string | null;
		end_at?: string | null;
		files?: unknown;
	} | null;
};

type BoadInertiaProps = {
	tenders?: {
		current_page?: number;
		last_page?: number;
		data?: BoadTenderRow[];
	};
	page?: BoadTenderRow;
	blocks?: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeEntities(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, codepoint: string) => String.fromCodePoint(Number(codepoint)))
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) => String.fromCodePoint(Number.parseInt(codepoint, 16)))
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, "\"")
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&ndash;|&mdash;/gi, "-")
		.replace(/&rsquo;|&lsquo;/gi, "'")
		.replace(/&laquo;|&raquo;/gi, "\"");
}

function stripHtml(value: string | null | undefined): string {
	if (!value) return "";
	return cleanText(decodeEntities(value
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>|<\/span>/gi, " ")
		.replace(/<[^>]+>/g, " ")));
}

function absoluteBoadUrl(rawUrl: string | undefined, sourceUrl = BOAD_TENDERS_URL): string | undefined {
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

function attrValue(attributes: string | undefined, name: string): string | undefined {
	const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(attributes ?? "");
	return match?.[1] ? decodeEntities(match[1]).trim() : undefined;
}

function parseInertiaProps(content: string): BoadInertiaProps | undefined {
	const trimmed = content.trim();
	const rawPage = trimmed.startsWith("{")
		? trimmed
		: /<div\b[^>]*\bid=["']app["'][^>]*\bdata-page=(["'])([\s\S]*?)\1[^>]*>/i.exec(content)?.[2];
	if (!rawPage) return undefined;
	try {
		const decoded = rawPage
			.replace(/&quot;/g, "\"")
			.replace(/&#039;|&#39;/g, "'")
			.replace(/&amp;/g, "&");
		const parsed = JSON.parse(decoded) as { props?: BoadInertiaProps };
		return parsed.props;
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
		.slice(0, 90);
}

function utcStartOfDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isExpired(deadline: Date | undefined, now = new Date()): boolean {
	return Boolean(deadline && deadline.getTime() < utcStartOfDay(now).getTime());
}

function pageLimit(): number {
	const parsed = Number(process.env.BOAD_PAGE_LIMIT ?? DEFAULT_PAGE_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT;
	return Math.min(60, Math.max(1, Math.trunc(parsed)));
}

function detailLimit(): number {
	const parsed = Number(process.env.BOAD_DETAIL_LIMIT ?? DEFAULT_DETAIL_LIMIT);
	if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_LIMIT;
	return Math.min(100, Math.max(0, Math.trunc(parsed)));
}

function monthNumber(value: string | undefined): number | undefined {
	const normalized = (value ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\.$/, "");
	const months: Record<string, number> = {
		janvier: 0, janv: 0,
		fevrier: 1, fevr: 1,
		mars: 2,
		avril: 3, avr: 3,
		mai: 4,
		juin: 5,
		juillet: 6, juil: 6,
		aout: 7,
		septembre: 8, sept: 8,
		octobre: 9, oct: 9,
		novembre: 10, nov: 10,
		decembre: 11, dec: 11,
	};
	return months[normalized];
}

function parseBoadDate(value: string | null | undefined): Date | undefined {
	const cleaned = stripHtml(value).replace(/\s+/g, " ").trim();
	if (!cleaned) return undefined;
	const slashMatch = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(cleaned);
	if (slashMatch) {
		return new Date(Date.UTC(Number(slashMatch[3]), Number(slashMatch[2]) - 1, Number(slashMatch[1]), 23, 59, 59));
	}
	const frenchMatch = /\b(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s+(\d{4})\b/i.exec(cleaned);
	if (frenchMatch) {
		const month = monthNumber(frenchMatch[2]);
		if (month !== undefined) {
			return new Date(Date.UTC(Number(frenchMatch[3]), month, Number(frenchMatch[1]), 23, 59, 59));
		}
	}
	const parsed = new Date(cleaned);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function deadlineTextFrom(row: BoadTenderRow): string | undefined {
	const explicit = stripHtml(row.acf?.end_at ?? undefined);
	if (explicit) return explicit;
	const text = stripHtml(row.acf?.presentation?.text ?? undefined);
	return /date\s+limite(?:\s+de\s+soumission)?\s*:?\s*([^.;<]+)/i.exec(text)?.[1]?.trim();
}

function referenceFrom(title: string): string | undefined {
	const normalized = title.replace(/[–—]/g, "-");
	const ascii = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
	return /\b(?:AAOP|AOOI|AOON|AON|AMI|AGPM|PPM|DAO|DP)\s*(?:N[°o]\s*)?[A-Z0-9/._\-\u2011]+(?:\/[A-Z0-9/._\-\u2011]+)*/i.exec(normalized)?.[0]
		?? /\bN[°o]\s*[A-Z0-9/._\-\u2011]+(?:\/[A-Z0-9/._\-\u2011]+)*/i.exec(normalized)?.[0]
		?? (/manifestation d.?interet/i.test(ascii) ? "AMI" : undefined);
}

function inferOpportunityType(title: string, category: string): OpportunityData["opportunityType"] {
	const haystack = `${title} ${category}`.toLowerCase();
	if (/manifestation d.?inter[eê]t|\bami\b|expression of interest|consultant|consultance/.test(haystack)) return "eoi";
	if (/\brfp\b|request for proposal|proposition|recrutement de consultant/.test(haystack)) return "rfp";
	return "tender";
}

function inferCategory(title: string): string {
	const normalized = title
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	if (/plan de passation|\bppm\b/.test(normalized)) return "Plan de passation des marchés";
	if (/manifestation d.?interet|\bami\b/.test(normalized)) return "Avis de manifestation d'intérêt";
	if (/passation de marche|\bagpm\b/.test(normalized)) return "Avis général de passation des marchés";
	return "Avis d'appel d'offre";
}

function inferCountryRegion(title: string, summary: string | undefined): string {
	const haystack = `${title} ${summary ?? ""}`
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	const countries: Array<[RegExp, string]> = [
		[/\bbenin\b/, "Benin"],
		[/burkina\s+faso/, "Burkina Faso"],
		[/\bcote\s+d.?ivoire\b|\bivoire\b/, "Cote d'Ivoire"],
		[/guinee[-\s]?bissau/, "Guinea-Bissau"],
		[/\bmali\b/, "Mali"],
		[/\bniger\b/, "Niger"],
		[/\bsenegal\b/, "Senegal"],
		[/\btogo\b|\btogolaise\b/, "Togo"],
		[/\brdc\b|republique democratique du congo|congo/, "Democratic Republic of the Congo"],
	];
	return countries.find(([pattern]) => pattern.test(haystack))?.[1] ?? "West Africa / UEMOA";
}

function isDocumentUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return /\.(?:pdf|docx?|xlsx?|zip|rar)(?:$|[?#])/i.test(parsed.pathname);
	} catch {
		return /\.(?:pdf|docx?|xlsx?|zip|rar)(?:$|[?#])/i.test(url);
	}
}

function collectDocumentLinks(value: unknown): BoadDocumentLink[] {
	const links: BoadDocumentLink[] = [];
	const seen = new Set<string>();
	const visit = (node: unknown, inheritedLabel?: string) => {
		if (Array.isArray(node)) {
			for (const item of node) visit(item, inheritedLabel);
			return;
		}
		if (!isRecord(node)) return;

		const label = [node.title, node.name, node.filename, node.subtitle, inheritedLabel]
			.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
		const url = typeof node.url === "string" ? absoluteBoadUrl(node.url) : undefined;
		const mimeType = typeof node.mime_type === "string" ? node.mime_type : "";
		if (url && !seen.has(url) && (isDocumentUrl(url) || /^application\//i.test(mimeType))) {
			seen.add(url);
			links.push({ label: stripHtml(label) || undefined, url });
		}

		for (const [key, child] of Object.entries(node)) {
			if (key === "default_media_model" || key === "media_model" || key === "media_models" || key === "image") continue;
			visit(child, label);
		}
	};
	visit(value);
	return links;
}

function documentLinksFromHtml(html: string, sourceUrl: string): BoadDocumentLink[] {
	const links: BoadDocumentLink[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const url = absoluteBoadUrl(attrValue(match[1] ?? "", "href"), sourceUrl);
		if (!url || seen.has(url) || !isDocumentUrl(url)) continue;
		seen.add(url);
		links.push({ label: stripHtml(match[2] ?? "") || undefined, url });
	}
	return links;
}

function titleFrom(row: BoadTenderRow): string {
	return stripHtml(row.acf?.presentation?.title ?? row.title);
}

function sourceIdFor(row: BoadTenderRow, title: string): string {
	const identity = row.external_id ?? row.id ?? row.slug ?? referenceFrom(title) ?? title;
	return `boad-${slugify(String(identity)) || "tender"}`;
}

function opportunityFromRow(
	row: BoadTenderRow,
	sourceUrl: string,
	options: {
		documentLinks?: BoadDocumentLink[];
		now?: Date;
	} = {}
): BoadOpportunity | undefined {
	const title = titleFrom(row);
	if (!title) return undefined;
	const portalUrl = absoluteBoadUrl(row.link, sourceUrl);
	if (!portalUrl) return undefined;

	const summary = stripHtml(row.acf?.presentation?.text ?? undefined) || undefined;
	const deadlineText = deadlineTextFrom(row);
	const deadline = parseBoadDate(deadlineText);
	if (isExpired(deadline, options.now)) return undefined;
	const publishedText = stripHtml(row.acf?.start_at ?? undefined) || undefined;
	const publishedDate = parseBoadDate(publishedText);
	const documentLinks = options.documentLinks ?? collectDocumentLinks(row.acf?.files);
	const primaryDocument = documentLinks.find((link) => /termes|tdr|tender|dossier|dao|appel|ami|avis/i.test(`${link.label ?? ""} ${link.url}`))
		?? documentLinks[0];
	const category = inferCategory(title);
	const reference = referenceFrom(title);

	return {
		title,
		source: "boad",
		sourceId: sourceIdFor(row, title),
		noticeId: reference ?? String(row.external_id ?? row.id ?? row.slug ?? sourceIdFor(row, title)),
		organization: "Banque Ouest Africaine de Développement (BOAD)",
		countryRegion: inferCountryRegion(title, summary),
		category,
		opportunityType: inferOpportunityType(title, category),
		publishedDate,
		deadline,
		portalUrl,
		documentUrl: primaryDocument?.url ?? portalUrl,
		rfpLink: primaryDocument?.url ?? portalUrl,
		projectSummary: [
			reference ? `Reference: ${reference}` : undefined,
			publishedText ? `Date de lancement: ${publishedText}` : undefined,
			deadlineText ? `Date limite: ${deadlineText}` : undefined,
			summary,
			documentLinks.length > 0 ? `${documentLinks.length} linked tender document(s) found.` : undefined,
		].filter(Boolean).join("; ") || "BOAD procurement opportunity.",
		submissionMethod: "Use the BOAD notice and linked tender documents for submission instructions.",
		tags: ["boad", "development-bank", "west-africa", "uemoa", "source-documents"],
		metadata: {
			boad: {
				reference,
				deadlineText,
				publishedText,
				detailUrl: portalUrl,
				documentLinks,
			},
		},
	};
}

function documentLinksFromDetailProps(props: BoadInertiaProps): BoadDocumentLink[] {
	const tenderHeader = props.blocks?.find((block) => {
		if (!isRecord(block)) return false;
		return block.acf_fc_layout === "tender_header_block" || block.component === "TenderHeaderBlock";
	});
	const blockData = isRecord(tenderHeader) ? tenderHeader.data : undefined;
	if (isRecord(blockData) && "files" in blockData) return collectDocumentLinks(blockData.files);
	return collectDocumentLinks(props.page?.acf?.files);
}

export function parseBoadTendersHtml(html: string, sourceUrl = BOAD_TENDERS_URL, now = new Date()): BoadOpportunity[] {
	const props = parseInertiaProps(html);
	const rows = props?.tenders?.data ?? [];
	const opportunities: BoadOpportunity[] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		const opportunity = opportunityFromRow(row, sourceUrl, { now });
		if (!opportunity || seen.has(opportunity.sourceId ?? opportunity.portalUrl)) continue;
		seen.add(opportunity.sourceId ?? opportunity.portalUrl);
		opportunities.push(opportunity);
	}
	return opportunities;
}

export function parseBoadTenderDetailHtml(html: string, sourceUrl: string, now = new Date()): BoadOpportunity[] {
	const props = parseInertiaProps(html);
	const page = props?.page;
	if (page?.type === "tender" || page?.link?.includes("/appels-doffre/")) {
		const opportunity = opportunityFromRow(page, sourceUrl, {
			documentLinks: documentLinksFromDetailProps(props ?? {}),
			now,
		});
		return opportunity ? [opportunity] : [];
	}
	const title = stripHtml(
		/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1]
		?? /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
	).replace(/\s+-\s+La BOAD$/i, "");
	if (!title || !/appel|offre|manifestation|tender|consultant|passation/i.test(title)) return [];
	return [{
		title,
		source: "boad",
		sourceId: `boad-${slugify(sourceUrl) || "tender"}`,
		noticeId: referenceFrom(title),
		organization: "Banque Ouest Africaine de Développement (BOAD)",
		countryRegion: inferCountryRegion(title, stripHtml(html)),
		category: inferCategory(title),
		opportunityType: inferOpportunityType(title, inferCategory(title)),
		portalUrl: sourceUrl,
		documentUrl: documentLinksFromHtml(html, sourceUrl)[0]?.url ?? sourceUrl,
		rfpLink: documentLinksFromHtml(html, sourceUrl)[0]?.url ?? sourceUrl,
		projectSummary: stripHtml(html).slice(0, 1200),
		submissionMethod: "Use the BOAD notice and linked tender documents for submission instructions.",
		tags: ["boad", "development-bank", "west-africa", "uemoa", "source-documents"],
		metadata: {
			boad: {
				reference: referenceFrom(title),
				detailUrl: sourceUrl,
				documentLinks: documentLinksFromHtml(html, sourceUrl),
			},
		},
	}];
}

async function fetchHtml(url: string): Promise<string> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(30000),
		headers: {
			"Accept": "text/html,application/xhtml+xml",
			"User-Agent": "Mozilla/5.0 (compatible; LindelaOpportunityDiscovery/1.0; +https://lindela.io)",
		},
	});
	if (!response.ok) {
		throw new Error(`BOAD tender fetch failed: ${response.status} ${response.statusText}`);
	}
	return response.text();
}

function pageUrlFor(baseUrl: string, page: number): string {
	const url = new URL(baseUrl || BOAD_TENDERS_URL);
	if (page <= 1) {
		url.searchParams.delete("page");
		return url.toString();
	}
	url.searchParams.set("page", String(page));
	return url.toString();
}

async function fetchBoadOpportunities(sourceUrl: string): Promise<BoadOpportunity[]> {
	const baseUrl = sourceUrl || BOAD_TENDERS_URL;
	const maxPages = pageLimit();
	const rows: BoadOpportunity[] = [];
	const seen = new Set<string>();
	let lastPage = maxPages;
	for (let page = 1; page <= Math.min(maxPages, lastPage); page++) {
		const html = await fetchHtml(pageUrlFor(baseUrl, page));
		const props = parseInertiaProps(html);
		lastPage = Math.min(maxPages, props?.tenders?.last_page ?? maxPages);
		const pageRows = parseBoadTendersHtml(html, pageUrlFor(baseUrl, page));
		if (pageRows.length === 0) break;
		for (const row of pageRows) {
			const identity = row.portalUrl;
			if (seen.has(identity)) continue;
			seen.add(identity);
			rows.push(row);
		}
	}

	const limit = detailLimit();
	if (limit <= 0 || rows.length === 0) return rows;
	const details = await Promise.all(rows.slice(0, limit).map(async (row) => {
		try {
			return parseBoadTenderDetailHtml(await fetchHtml(row.portalUrl), row.portalUrl)[0];
		} catch {
			return undefined;
		}
	}));
	return rows.map((row, index) => details[index] ?? row);
}

export const boadParser: TenderParser = {
	sourceId: "boad",
	name: "BOAD Appels d'offres",
	requiresJavascript: false,

	async parse(input: ParseInput): Promise<ParseResult> {
		if (!input.html?.trim() && !input.markdown?.trim() && input.url) {
			return { opportunities: await fetchBoadOpportunities(input.url) };
		}
		const content = input.html ?? input.markdown ?? "";
		const props = parseInertiaProps(content);
		if (props?.tenders) return { opportunities: parseBoadTendersHtml(content, input.url) };
		return { opportunities: parseBoadTenderDetailHtml(content, input.url) };
	},

	getPageUrl(baseUrl: string, page: number): string {
		return pageUrlFor(baseUrl || BOAD_TENDERS_URL, page);
	},

	hasNextPage(content: ParseInput, currentPage: number): boolean {
		const props = parseInertiaProps(content.html ?? content.markdown ?? "");
		return currentPage < (props?.tenders?.last_page ?? currentPage);
	},
};

registerParser(boadParser);
