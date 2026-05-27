import "./load-env";

import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { fetchPublicHttpUrl } from "@/lib/security/public-url";
import { FirecrawlClient } from "@/lib/scrapers/firecrawl";
import { afdbParser, parseAfdbNoticeDetailMarkdown } from "@/lib/scrapers/parsers/afdb";
import { comesaParser, parseComesaTenderDetailMarkdown } from "@/lib/scrapers/parsers/comesa";
import { checkDoclingHealth, convertDocument, type DoclingConvertResponse } from "@/lib/services/docling-client";
import {
	buildLiveResponsePackage,
	type LiveResponsePackage,
	type LiveResponseReadinessAssessment,
} from "@/lib/services/live-response-package";
import { scrapeWithCloakBrowser } from "@/lib/services/cloakbrowser-scraper-client";
import { fetchKenyaPpipOpportunities } from "@/lib/services/kenya-ppip-client";
import { searchSearxng, type SearxngResult } from "@/lib/services/searxng-client";
import { fetchUngmOpportunities } from "@/lib/services/ungm-client";
import {
	fetchWorldBankNoticeDetail,
	fetchWorldBankNoticeList,
	worldBankNoticeListApiUrl,
	worldBankNoticeApiUrl,
	worldBankNoticeIdFromUrl,
	worldBankParser,
	type WorldBankNoticeDetail,
} from "@/lib/scrapers/parsers/world-bank";
import type { OpportunityData } from "@/lib/scrapers/deduplicator";
import type { ProposalDocumentType } from "@/lib/types/opportunity";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const SOURCE_KIND = normalizeSourceKind(process.env.LIVE_RESPONSE_READINESS_SOURCE_KIND);
const PROOF_RUN_PREFIX = process.env.LIVE_RESPONSE_READINESS_PROOF_PREFIX ?? (
	SOURCE_KIND === "kenya_ppip"
		? "live_kenya_ppip_response_readiness"
		: SOURCE_KIND === "afdb"
			? "live_afdb_response_readiness"
			: SOURCE_KIND === "world_bank"
				? "live_world_bank_response_readiness"
				: SOURCE_KIND === "comesa"
					? "live_comesa_response_readiness"
					: "live_response_readiness"
);
const RUN_ID = process.env.LIVE_RESPONSE_READINESS_PROOF_RUN_ID ?? createProofRunId(PROOF_RUN_PREFIX);
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-response-readiness" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-opportunity-response-readiness-evidence.md");
const SOURCE_URL = process.env.LIVE_RESPONSE_READINESS_SOURCE_URL ?? (
	SOURCE_KIND === "kenya_ppip"
		? "https://tenders.go.ke/tenders"
		: SOURCE_KIND === "afdb"
			? "https://www.afdb.org/en/projects-and-operations/procurement"
			: SOURCE_KIND === "world_bank"
				? "https://projects.worldbank.org/en/projects-operations/procurement"
				: SOURCE_KIND === "comesa"
					? "https://www.comesa.int/category/open-tenders/"
					: "https://www.ungm.org/Public/Notice?title=software"
);
const MAX_DOCUMENT_BYTES = Number(process.env.LIVE_RESPONSE_READINESS_MAX_DOCUMENT_BYTES ?? 10 * 1024 * 1024);
const SOURCE_PAGE_LIMIT = Number(process.env.LIVE_RESPONSE_READINESS_PAGE_LIMIT ?? (SOURCE_KIND === "kenya_ppip" ? 25 : 10));
const SOURCE_LIMIT = Number(process.env.LIVE_RESPONSE_READINESS_SOURCE_LIMIT ?? 10);
const SOURCE_DETAIL_LIMIT = Number(process.env.LIVE_RESPONSE_READINESS_DETAIL_LIMIT ?? 5);
const DOCLING_CONVERSION_ATTEMPTS = Number(process.env.LIVE_RESPONSE_READINESS_DOCLING_ATTEMPTS ?? 3);
const SOURCE_SCRAPE_ATTEMPTS = Number(process.env.LIVE_RESPONSE_READINESS_SOURCE_SCRAPE_ATTEMPTS ?? 3);
const AFDB_SEARCH_QUERIES = [
	"afdb procurement reoi pdf mobile application",
	"afdb procurement request for expressions of interest pdf software system",
	"afdb project related procurement pdf consulting services",
	"African Development Bank funded procurement REOI PDF consultant services",
];
const RESPONSE_READY_TERM_PATTERNS = [
	{ pattern: /\bsoftware\b/iu, weight: 12 },
	{ pattern: /\bsystems?\b/iu, weight: 11 },
	{ pattern: /\bsistema\b/iu, weight: 11 },
	{ pattern: /\bapi\b/iu, weight: 10 },
	{ pattern: /\bsecurity\b/iu, weight: 10 },
	{ pattern: /\bdigital\b/iu, weight: 10 },
	{ pattern: /\bdata\b/iu, weight: 9 },
	{ pattern: /\bapplications?\b/iu, weight: 9 },
	{ pattern: /\bmobile\b/iu, weight: 9 },
	{ pattern: /\bplatforms?\b/iu, weight: 9 },
	{ pattern: /\bsolutions?\b/iu, weight: 8 },
	{ pattern: /\baudit\b/iu, weight: 7 },
	{ pattern: /\bict\b/iu, weight: 7 },
	{ pattern: /\benergy\s+management\b/iu, weight: 7 },
	{ pattern: /\bcapacity\s+building\b/iu, weight: 6 },
	{ pattern: /\bimplementation\b/iu, weight: 6 },
	{ pattern: /\bconsultants?\b/iu, weight: 4 },
	{ pattern: /\bconsulting\b/iu, weight: 4 },
	{ pattern: /\bconsultancy\b/iu, weight: 4 },
	{ pattern: /\bservices?\b/iu, weight: 3 },
	{ pattern: /\bsurvey\b/iu, weight: 2 },
] as const;
const PROPOSAL_DOCUMENT_TYPES: ProposalDocumentType[] = [
	"cover_letter",
	"executive_summary",
	"technical_approach",
	"management_plan",
	"past_performance",
	"cost_proposal",
];
const PROCUREMENT_INDICATORS = [
	"request for expression of interest",
	"request for proposal",
	"eoi",
	"proposal",
	"tender",
	"procurement",
	"submission",
];

interface LiveOpportunityResponseReadinessProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	source: {
		kind: LiveResponseReadinessSourceKind;
		url: string;
		searchUrl?: string;
		apiUrl?: string;
		total?: number;
		opportunityCount: number;
	};
	opportunity?: {
		title: string;
		organization?: string;
		sourceId?: string;
		portalUrl?: string;
		documentUrl: string;
	};
	document?: {
		url: string;
		status: number;
		contentType?: string;
		byteLength: number;
		extractedTextLength: number;
		doclingStatus?: string;
		extractionMethod?: "docling-document" | "world-bank-notice-api";
		procurementIndicators: string[];
		extractedPreview: string;
	};
	responseReadiness?: {
		documentTypes: ProposalDocumentType[];
		totalSectionSeeds: number;
		pursuitFit: LiveResponsePackage["pursuitFit"];
		sourceRequirementCount: number;
		winThemeSeedCount: number;
		relevantSnippetCount: number;
		relevantSnippetShortcuts: string[];
		seededDocumentWordCounts: Record<string, number>;
		draftArtifactHashes: Record<string, string>;
		totalDraftWordCount: number;
		draftArtifactPaths: string[];
		readiness: LiveResponseReadinessAssessment;
	};
	error?: string;
}

interface ExtractedSourceDocument {
	document: NonNullable<LiveOpportunityResponseReadinessProof["document"]>;
	sourceText: string;
}

interface SourceDocumentConversion {
	converted: DoclingConvertResponse;
	extractedText: string;
	procurementIndicators: string[];
}

type LiveResponseReadinessSourceKind = "ungm" | "kenya_ppip" | "afdb" | "world_bank" | "comesa";

interface LiveResponseReadinessSourceResult {
	kind: LiveResponseReadinessSourceKind;
	url: string;
	searchUrl?: string;
	apiUrl?: string;
	total?: number;
	opportunities: OpportunityData[];
}

async function main() {
	const proof: LiveOpportunityResponseReadinessProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		source: {
			kind: SOURCE_KIND,
			url: SOURCE_URL,
			opportunityCount: 0,
		},
	};

	try {
		const result = await proveLiveOpportunityResponseReadiness();
		Object.assign(proof, result);
		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function proveLiveOpportunityResponseReadiness(): Promise<Partial<LiveOpportunityResponseReadinessProof>> {
	const source = await fetchSourceOpportunities();
	const opportunity = source.kind === "world_bank"
		? selectWorldBankResponseReadyOpportunity(source.opportunities)
		: source.kind === "comesa"
			? selectComesaResponseReadyOpportunity(source.opportunities)
		: selectResponseReadyOpportunity(source.opportunities);
	const sourceUrl = opportunity?.rfpLink ?? opportunity?.documentUrl ?? opportunity?.portalUrl;
	if (!opportunity || !sourceUrl) {
		throw new Error(`${source.kind} source returned no response-ready opportunity with source material`);
	}

	const extracted = source.kind === "world_bank"
		? await fetchAndExtractWorldBankNotice(opportunity)
		: await fetchAndExtractSourceDocument(sourceUrl);
	const responsePackage = buildLiveResponsePackage({
		opportunity,
		sourceText: extracted.sourceText,
	});
	const draftArtifactPaths = await writeResponsePackageArtifacts(responsePackage);
	const responseReadiness = proveResponseSeedReadiness(responsePackage, draftArtifactPaths);

	return {
		source: {
			kind: source.kind,
			url: SOURCE_URL,
			searchUrl: source.searchUrl,
			apiUrl: source.apiUrl,
			total: source.total,
			opportunityCount: source.opportunities.length,
		},
		opportunity: {
			title: opportunity.title,
			organization: opportunity.organization,
			sourceId: opportunity.sourceId,
			portalUrl: opportunity.portalUrl,
			documentUrl: extracted.document.url,
		},
		document: extracted.document,
		responseReadiness,
	};
}

async function fetchSourceOpportunities(): Promise<LiveResponseReadinessSourceResult> {
	if (SOURCE_KIND === "kenya_ppip") {
		const source = await fetchKenyaPpipOpportunities(SOURCE_URL, {
			limit: SOURCE_LIMIT,
			timeoutMs: 20000,
		});
		return {
			kind: "kenya_ppip",
			url: SOURCE_URL,
			apiUrl: source.apiUrl,
			total: source.total,
			opportunities: source.opportunities,
		};
	}
	if (SOURCE_KIND === "afdb") {
		return fetchAfdbResponseReadyOpportunities();
	}
	if (SOURCE_KIND === "world_bank") {
		return fetchWorldBankResponseReadyOpportunities();
	}
	if (SOURCE_KIND === "comesa") {
		return fetchComesaResponseReadyOpportunities();
	}

	const source = await fetchUngmOpportunities(SOURCE_URL, {
		limit: SOURCE_LIMIT,
		timeoutMs: 20000,
		detailLimit: SOURCE_DETAIL_LIMIT,
	});
	return {
		kind: "ungm",
		url: SOURCE_URL,
		searchUrl: source.searchUrl,
		total: source.total,
		opportunities: source.opportunities,
	};
}

async function fetchAfdbResponseReadyOpportunities(): Promise<LiveResponseReadinessSourceResult> {
	const client = new FirecrawlClient({ timeout: 60000 });
	let lastError: string | undefined;
	for (let attempt = 1; attempt <= SOURCE_SCRAPE_ATTEMPTS; attempt += 1) {
		const result = await client.scrape(SOURCE_URL, {
			formats: ["markdown", "html", "links"],
			timeout: 60000,
		});
		const markdown = result.data?.markdown ?? result.data?.html ?? "";
		const links = result.data?.links ?? [];
		if (!result.success || markdown.trim().length === 0) {
			lastError = result.error ?? `AFDB source scrape returned no content on attempt ${attempt}`;
			continue;
		}

		const parsed = await afdbParser.parse({ markdown, links, url: SOURCE_URL });
		if (parsed.opportunities.length === 0) {
			lastError = `AFDB parser found no source opportunities on attempt ${attempt}`;
			continue;
		}

		const opportunities = await attachAfdbSourceDocuments(client, parsed.opportunities);
		if (opportunities.some(hasDirectSourceDocument)) {
			return {
				kind: "afdb",
				url: SOURCE_URL,
				opportunities,
			};
		}
		lastError = `AFDB detail pages exposed no downloadable source documents on attempt ${attempt}`;
	}

	const cloakOpportunities = await fetchAfdbCloakBrowserOpportunities(lastError);
	if (cloakOpportunities.length > 0) {
		return {
			kind: "afdb",
			url: SOURCE_URL,
			opportunities: cloakOpportunities,
		};
	}

	const fallbackOpportunities = await fetchAfdbSearchFallbackOpportunities();
	if (fallbackOpportunities.length > 0) {
		return {
			kind: "afdb",
			url: SOURCE_URL,
			searchUrl: "https://search.lindela.io",
			opportunities: fallbackOpportunities,
		};
	}

	throw new Error(lastError ?? "AFDB source returned no response-ready opportunities");
}

async function fetchWorldBankResponseReadyOpportunities(): Promise<LiveResponseReadinessSourceResult> {
	const client = new FirecrawlClient({ timeout: 60000 });
	const result = await client.scrape(SOURCE_URL, {
		formats: ["markdown", "links"],
		timeout: 60000,
	});
	const markdown = result.data?.markdown ?? "";
	const links = result.data?.links ?? [];
	if (!result.success || markdown.trim().length === 0) {
		throw new Error(result.error ?? "World Bank source scrape returned no content");
	}
	const parsed = await worldBankParser.parse({ markdown, links, url: SOURCE_URL });
	const opportunities = parsed.opportunities.filter((opportunity) => !/\baward\b/iu.test(opportunity.category ?? ""));
	if (opportunities.length > 0) {
		return {
			kind: "world_bank",
			url: SOURCE_URL,
			opportunities,
		};
	}

	const apiOpportunities = await fetchWorldBankNoticeList(Math.max(SOURCE_LIMIT * 4, 20));
	if (apiOpportunities.length === 0) {
		throw new Error("World Bank parser and notice list API returned no active source opportunities");
	}
	return {
		kind: "world_bank",
		url: SOURCE_URL,
		apiUrl: worldBankNoticeListApiUrl(Math.max(SOURCE_LIMIT * 4, 20)),
		opportunities: apiOpportunities,
	};
}

async function fetchComesaResponseReadyOpportunities(): Promise<LiveResponseReadinessSourceResult> {
	const client = new FirecrawlClient({ timeout: 60000 });
	const result = await client.scrape(SOURCE_URL, {
		formats: ["markdown", "links"],
		timeout: 60000,
	});
	const markdown = result.data?.markdown ?? "";
	const links = result.data?.links ?? [];
	if (!result.success || markdown.trim().length === 0) {
		throw new Error(result.error ?? "COMESA source scrape returned no content");
	}
	const parsed = await comesaParser.parse({ markdown, links, url: SOURCE_URL });
	if (parsed.opportunities.length === 0) {
		throw new Error("COMESA parser returned no active source opportunities");
	}
	const opportunities = await attachComesaSourceDocuments(client, parsed.opportunities);
	if (!opportunities.some(hasDirectSourceDocument)) {
		throw new Error("COMESA detail pages exposed no downloadable source documents");
	}
	return {
		kind: "comesa",
		url: SOURCE_URL,
		opportunities,
	};
}

async function attachComesaSourceDocuments(
	client: FirecrawlClient,
	opportunities: OpportunityData[]
): Promise<OpportunityData[]> {
	const enriched: OpportunityData[] = [];
	for (const opportunity of opportunities.slice(0, SOURCE_LIMIT)) {
		if (!opportunity.portalUrl) {
			enriched.push(opportunity);
			continue;
		}
		const detailResult = await client.scrape(opportunity.portalUrl, {
			formats: ["markdown", "links"],
			timeout: 60000,
		});
		const detail = parseComesaTenderDetailMarkdown(
			detailResult.data?.markdown,
			detailResult.data?.links ?? [],
			opportunity.portalUrl
		);
		const documentUrl = detail.primaryLink?.url;
		enriched.push(documentUrl
			? {
				...opportunity,
				rfpLink: documentUrl,
				documentUrl,
				metadata: {
					...(opportunity.metadata ?? {}),
					comesa: {
						...comesaMetadata(opportunity),
						detailDocumentUrl: documentUrl,
						detailDocumentLabel: detail.primaryLink?.description,
						detailDocumentLinkCount: detail.links.length,
					},
				},
			}
			: opportunity);
	}
	return enriched;
}

async function fetchAfdbCloakBrowserOpportunities(previousFailure: string | undefined): Promise<OpportunityData[]> {
	const result = await scrapeWithCloakBrowser(SOURCE_URL, {
		timeout: 60000,
		humanScroll: true,
		blockMedia: true,
	});
	if (!result.success || !result.data) {
		return [];
	}
	const markdown = result.data.markdown ?? result.data.html ?? "";
	const links = result.data.links ?? [];
	const parsed = await afdbParser.parse({ markdown, links, url: SOURCE_URL });
	if (parsed.opportunities.length === 0) {
		return [];
	}
	const client = new FirecrawlClient({ timeout: 60000 });
	const opportunities = await attachAfdbSourceDocuments(client, parsed.opportunities);
	if (opportunities.some(hasDirectSourceDocument)) {
		return opportunities.map((opportunity) => ({
			...opportunity,
			metadata: {
				...(opportunity.metadata ?? {}),
				afdb: {
					...afdbMetadata(opportunity),
					listingDiscoveryMethod: "cloakbrowser-cdp",
					previousListingFailure: previousFailure,
				},
			},
		}));
	}
	return [];
}

function hasDirectSourceDocument(opportunity: OpportunityData): boolean {
	const documentUrl = opportunity.rfpLink ?? opportunity.documentUrl ?? "";
	return /\.(pdf|docx?)(?:$|[?#])/iu.test(documentUrl);
}

async function attachAfdbSourceDocuments(
	client: FirecrawlClient,
	opportunities: OpportunityData[]
): Promise<OpportunityData[]> {
	const enriched: OpportunityData[] = [];
	for (const opportunity of opportunities.slice(0, SOURCE_LIMIT)) {
		if (!opportunity.portalUrl) {
			enriched.push(opportunity);
			continue;
		}
		const detailResult = await client.scrape(opportunity.portalUrl, {
			formats: ["markdown", "links"],
			timeout: 60000,
		});
		const detail = parseAfdbNoticeDetailMarkdown(
			detailResult.data?.markdown,
			detailResult.data?.links ?? [],
			opportunity.portalUrl
		);
		const documentUrl = detail.primaryLink?.url;
		enriched.push(documentUrl
			? {
				...opportunity,
				rfpLink: documentUrl,
				documentUrl,
				metadata: {
					...(opportunity.metadata ?? {}),
					afdb: {
						...afdbMetadata(opportunity),
						detailDocumentUrl: documentUrl,
						detailDocumentLabel: detail.primaryLink?.description,
						detailDocumentLinkCount: detail.links.length,
					},
				},
			}
			: opportunity);
	}
	return enriched;
}

async function fetchAfdbSearchFallbackOpportunities(): Promise<OpportunityData[]> {
	const candidates: OpportunityData[] = [];
	const seen = new Set<string>();
	for (const query of AFDB_SEARCH_QUERIES) {
		const response = await searchSearxng(query, {
			sendAcceptHeader: false,
		});
		for (const result of response.results) {
			const opportunity = afdbOpportunityFromSearchResult(result, query);
			if (!opportunity) continue;
			const documentUrl = opportunity.rfpLink ?? opportunity.documentUrl;
			if (!documentUrl || !(await isDownloadableSourceDocument(documentUrl))) continue;
			const key = opportunity.rfpLink ?? opportunity.documentUrl ?? opportunity.portalUrl ?? opportunity.title;
			if (seen.has(key)) continue;
			seen.add(key);
			candidates.push(opportunity);
			if (candidates.length >= SOURCE_LIMIT) {
				return candidates;
			}
		}
	}
	return candidates;
}

function afdbOpportunityFromSearchResult(result: SearxngResult, query: string): OpportunityData | undefined {
	const documentUrl = afdbDocumentUrlFromSearchResult(result);
	if (!documentUrl) return undefined;
	const title = cleanSearchTitle(result.title);
	const lower = `${title} ${result.content} ${documentUrl}`.toLowerCase();
	if (!/(reoi|eoi|ifb|spn|request|expression of interest|tender|procurement|consultant|consulting)/iu.test(lower)) {
		return undefined;
	}
	const sourceId = crypto.createHash("sha256").update(documentUrl).digest("hex").slice(0, 24);
	return {
		title,
		source: "afdb",
		sourceId,
		noticeId: sourceId,
		organization: "African Development Bank",
		category: lower.includes("expression of interest") || lower.includes("reoi") || lower.includes("eoi")
			? "Expression of interest"
			: "Tender",
		opportunityType: lower.includes("expression of interest") || lower.includes("reoi") || lower.includes("eoi")
			? "eoi"
			: "tender",
		portalUrl: result.url,
		documentUrl,
		rfpLink: documentUrl,
		projectSummary: result.content || title,
		tags: ["afdb", "development-bank", "regional-procurement", "search-fallback"],
		metadata: {
			afdb: {
				discoveryMethod: "searxng-document-search",
				query,
				engine: result.engine,
				score: result.score,
			},
		},
	};
}

function afdbDocumentUrlFromSearchResult(result: SearxngResult): string | undefined {
	try {
		const url = result.url;
		const parsed = new URL(url);
		if (!/\.(pdf|docx?)(?:$|[?#])/iu.test(parsed.pathname)) return undefined;
		if (/operations?[-_]?procurement[-_]?manual|opm-part/iu.test(parsed.pathname)) return undefined;
		const haystack = `${result.title} ${result.content} ${url}`.toLowerCase();
		if (/(^|\.)afdb\.org$/iu.test(parsed.hostname)) return undefined;
		if (!/(african development bank|afdb)/iu.test(haystack)) {
			return undefined;
		}
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

async function isDownloadableSourceDocument(url: string): Promise<boolean> {
	const response = await fetchPublicHttpUrl(url, {
		headers: {
			"User-Agent": "DocFusion/1.0 live-response-readiness-proof",
			Range: "bytes=0-1023",
		},
		timeoutMs: 15000,
	}, "AFDB response-readiness fallback document probe").catch(() => undefined);
	if (!response?.ok) return false;
	const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
	return !contentType.includes("text/html");
}

function cleanSearchTitle(title: string): string {
	return title
		.replace(/\s*-\s*African Development Bank\s*$/iu, "")
		.replace(/\s*\.\.\.\s*$/u, "")
		.replace(/\s+/gu, " ")
		.trim()
		|| "AFDB procurement opportunity";
}

function afdbMetadata(opportunity: OpportunityData): Record<string, unknown> {
	const value = opportunity.metadata?.afdb;
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}

function comesaMetadata(opportunity: OpportunityData): Record<string, unknown> {
	const value = opportunity.metadata?.comesa;
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}

function selectResponseReadyOpportunity(opportunities: OpportunityData[]): OpportunityData | undefined {
	return opportunities.find((opportunity) => {
		const documentUrl = opportunity.rfpLink ?? opportunity.documentUrl ?? "";
		return /\.(pdf|docx?)(?:$|[?#])/iu.test(documentUrl) && hasResponseReadyTerms(opportunity, documentUrl);
	});
}

function selectWorldBankResponseReadyOpportunity(opportunities: OpportunityData[]): OpportunityData | undefined {
	const scored = opportunities
		.map((opportunity, index) => {
			const sourceUrl = opportunity.portalUrl ?? opportunity.rfpLink ?? opportunity.documentUrl ?? "";
			return {
				opportunity,
				index,
				hasNoticeId: Boolean(worldBankNoticeIdFromUrl(sourceUrl)),
				score: scoreResponseReadyTerms(opportunity, sourceUrl),
			};
		})
		.filter((candidate) => candidate.hasNoticeId)
		.sort((left, right) => right.score - left.score || left.index - right.index);
	return scored.find((candidate) => candidate.score > 0)?.opportunity
		?? scored[0]?.opportunity;
}

function hasResponseReadyTerms(opportunity: OpportunityData, sourceUrl: string): boolean {
	return scoreResponseReadyTerms(opportunity, sourceUrl) > 0;
}

function scoreResponseReadyTerms(opportunity: OpportunityData, sourceUrl: string): number {
	const haystack = `${opportunity.title} ${opportunity.projectSummary ?? ""} ${opportunity.category ?? ""} ${sourceUrl}`.toLowerCase();
	return RESPONSE_READY_TERM_PATTERNS.reduce(
		(score, { pattern, weight }) => score + (pattern.test(haystack) ? weight : 0),
		0
	);
}

function selectComesaResponseReadyOpportunity(opportunities: OpportunityData[]): OpportunityData | undefined {
	return opportunities.find((opportunity) => {
		const documentUrl = opportunity.rfpLink ?? opportunity.documentUrl ?? "";
		const haystack = `${opportunity.title} ${opportunity.category ?? ""} ${documentUrl}`.toLowerCase();
		return /\.(pdf|docx?)(?:$|[?#])/iu.test(documentUrl)
			&& /\b(rfp|request|proposal|tender|procurement|consultancy|services?)\b/iu.test(haystack);
	});
}

async function fetchAndExtractWorldBankNotice(opportunity: OpportunityData): Promise<ExtractedSourceDocument> {
	const noticeId = opportunity.noticeId ?? opportunity.sourceId ?? worldBankNoticeIdFromUrl(opportunity.portalUrl);
	if (!noticeId) {
		throw new Error("World Bank opportunity did not expose a procurement notice ID");
	}
	const detail = await fetchWorldBankNoticeDetail(noticeId);
	const sourceText = buildWorldBankNoticeSourceText(opportunity, detail);
	if (sourceText.length < 1000) {
		throw new Error(`World Bank notice API returned too little source text: ${sourceText.length} characters`);
	}
	const procurementIndicators = PROCUREMENT_INDICATORS.filter((indicator) => sourceText.toLowerCase().includes(indicator));
	if (procurementIndicators.length === 0) {
		throw new Error("World Bank notice source text did not contain procurement response language");
	}
	const apiUrl = worldBankNoticeApiUrl(noticeId);
	const byteLength = Buffer.byteLength(sourceText, "utf8");
	return {
		document: {
			url: apiUrl,
			status: 200,
			contentType: "application/json",
			byteLength,
			extractedTextLength: sourceText.length,
			doclingStatus: "not-applicable",
			extractionMethod: "world-bank-notice-api",
			procurementIndicators,
			extractedPreview: compactText(sourceText.replace(/\s+/g, " "), 500),
		},
		sourceText,
	};
}

function buildWorldBankNoticeSourceText(opportunity: OpportunityData, detail: WorldBankNoticeDetail): string {
	return [
		"# World Bank Procurement Notice",
		`Title: ${opportunity.title}`,
		`Notice ID: ${opportunity.noticeId ?? opportunity.sourceId ?? ""}`,
		`Notice Type: ${detail.noticeType ?? opportunity.category ?? ""}`,
		`Project ID: ${detail.projectId ?? ""}`,
		`Project Title: ${detail.projectTitle ?? ""}`,
		`Borrower Bid Reference: ${detail.borrowerBidReference ?? ""}`,
		`Procurement Method: ${detail.procurementMethod ?? ""}`,
		`Submission Deadline: ${dateLikeToIso(detail.submissionDeadline) ?? ""}`,
		`Published Date: ${dateLikeToIso(detail.publishedDate) ?? dateLikeToIso(opportunity.publishedDate) ?? ""}`,
		`Organization: ${detail.organization ?? opportunity.organization ?? ""}`,
		`Contact Email: ${detail.contactEmail ?? ""}`,
		"",
		"## Solicitation Details",
		detail.details ?? opportunity.projectSummary ?? "",
	].filter((line) => line !== undefined).join("\n").trim();
}

function dateLikeToIso(value: Date | string | null | undefined): string | undefined {
	if (!value) return undefined;
	if (value instanceof Date) return value.toISOString();
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

async function fetchAndExtractSourceDocument(documentUrl: string): Promise<ExtractedSourceDocument> {
	const doclingHealthy = await checkDoclingHealth();
	if (!doclingHealthy) {
		throw new Error("Docling health check failed before live response source extraction");
	}

	const response = await fetchPublicHttpUrl(documentUrl, {
		headers: {
			"User-Agent": "DocFusion/1.0 live-response-readiness-proof",
		},
		timeoutMs: 30000,
		allowInvalidTlsForHosts: ["tenders.go.ke"],
	}, "live response readiness source document");
	if (!response.ok) {
		throw new Error(`Live response source document returned HTTP ${response.status}`);
	}

	const contentType = response.headers.get("content-type") ?? undefined;
	const documentBytes = Buffer.from(await response.arrayBuffer());
	if (documentBytes.length > MAX_DOCUMENT_BYTES) {
		throw new Error(`Live response source document exceeded ${MAX_DOCUMENT_BYTES} bytes`);
	}

	const filename = filenameFromUrl(documentUrl);
	const { converted, extractedText, procurementIndicators } = await convertSourceDocumentWithRetries(documentBytes, filename);

	return {
		document: {
			url: documentUrl,
			status: response.status,
			contentType,
			byteLength: documentBytes.length,
			extractedTextLength: extractedText.length,
			doclingStatus: converted.status,
			extractionMethod: "docling-document",
			procurementIndicators,
			extractedPreview: compactText(extractedText.replace(/\s+/g, " "), 500),
		},
		sourceText: extractedText,
	};
}

async function convertSourceDocumentWithRetries(
	documentBytes: Buffer,
	filename: string
): Promise<SourceDocumentConversion> {
	let lastError: Error | undefined;
	for (let attempt = 1; attempt <= DOCLING_CONVERSION_ATTEMPTS; attempt += 1) {
		try {
			const converted = await convertDocument(documentBytes, filename, {
				outputFormat: "text",
				ocr: false,
				extractTables: false,
				extractImages: false,
				pageRange: [1, SOURCE_PAGE_LIMIT],
				documentTimeoutSeconds: 90,
			});
			const extractedText = cleanExtractedText(converted.text ?? converted.markdown ?? "");
			if (converted.status && converted.status !== "success" && converted.status !== "partial_success") {
				throw new Error(`Docling conversion did not succeed: ${converted.status}`);
			}
			if (extractedText.length < 1000) {
				throw new Error(`Docling extracted too little source text: ${extractedText.length} characters`);
			}
			const procurementIndicators = PROCUREMENT_INDICATORS.filter((indicator) => extractedText.toLowerCase().includes(indicator));
			if (procurementIndicators.length === 0) {
				throw new Error("Docling source text did not contain procurement response language");
			}
			return { converted, extractedText, procurementIndicators };
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt < DOCLING_CONVERSION_ATTEMPTS) {
				await delay(750 * attempt);
			}
		}
	}

	throw lastError ?? new Error("Docling conversion failed without an error detail");
}

function proveResponseSeedReadiness(
	responsePackage: LiveResponsePackage,
	draftArtifactPaths: string[]
): NonNullable<LiveOpportunityResponseReadinessProof["responseReadiness"]> {
	const seededDocumentWordCounts: Record<string, number> = {};
	const draftArtifactHashes: Record<string, string> = {};
	let totalSectionSeeds = 0;

	for (const document of responsePackage.documents) {
		totalSectionSeeds += document.sectionSeedCount;
		if (/\{\{(?:client_name|opportunity_name)\}\}/.test(document.markdown)) {
			throw new Error(`Response draft for ${document.documentType} still contains required placeholders`);
		}
		seededDocumentWordCounts[document.documentType] = document.wordCount;
		draftArtifactHashes[document.documentType] = document.artifact.contentHash;
	}

	if (responsePackage.requirements.length < 3) {
		throw new Error(`Too few source requirement signals for live response package: ${responsePackage.requirements.length}`);
	}
	if (responsePackage.relevantSnippetCount < 10) {
		throw new Error(`Too few relevant Datacraft snippets for live opportunity: ${responsePackage.relevantSnippetCount}`);
	}
	if (responsePackage.totalWordCount < 2000) {
		throw new Error(`Live response package draft is too thin: ${responsePackage.totalWordCount} words`);
	}
	if (responsePackage.readiness.status !== "ready_for_review") {
		throw new Error(`Live response package readiness blocked: ${responsePackage.readiness.blockers.join("; ")}`);
	}

	return {
		documentTypes: PROPOSAL_DOCUMENT_TYPES,
		totalSectionSeeds,
		pursuitFit: responsePackage.pursuitFit,
		sourceRequirementCount: responsePackage.requirements.length,
		winThemeSeedCount: responsePackage.winThemeSeeds.length,
		relevantSnippetCount: responsePackage.relevantSnippetCount,
		relevantSnippetShortcuts: responsePackage.relevantSnippetShortcuts.slice(0, 12),
		seededDocumentWordCounts,
		draftArtifactHashes,
		totalDraftWordCount: responsePackage.totalWordCount,
		draftArtifactPaths,
		readiness: responsePackage.readiness,
	};
}

function normalizeSourceKind(value: string | undefined): LiveResponseReadinessSourceKind {
	if (value === "kenya_ppip") return "kenya_ppip";
	if (value === "afdb") return "afdb";
	if (value === "world_bank") return "world_bank";
	if (value === "comesa") return "comesa";
	return "ungm";
}

function filenameFromUrl(url: string): string {
	try {
		const pathname = new URL(url).pathname;
		const filename = pathname.split("/").filter(Boolean).pop();
		return filename || "source-document.pdf";
	} catch {
		return "source-document.pdf";
	}
}

function cleanExtractedText(text: string): string {
	return text
		.replace(/!\[Image]\(data:image\/[^)]+\)/g, " ")
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function compactText(text: string, maxLength: number): string {
	return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeResponsePackageArtifacts(responsePackage: LiveResponsePackage): Promise<string[]> {
	const packageDir = path.resolve(LOG_DIR, "response-package");
	await fs.mkdir(packageDir, { recursive: true });
	const relativePaths: string[] = [];
	for (const document of responsePackage.documents) {
		const filePath = path.resolve(packageDir, document.artifact.filename);
		await fs.writeFile(filePath, document.markdown, "utf8");
		const readback = await fs.readFile(filePath, "utf8");
		const readbackHash = crypto.createHash("sha256").update(readback).digest("hex");
		if (readbackHash !== document.artifact.contentHash) {
			throw new Error(`Draft artifact readback hash mismatch for ${document.documentType}`);
		}
		if (Buffer.byteLength(readback, "utf8") !== document.artifact.sizeBytes) {
			throw new Error(`Draft artifact readback size mismatch for ${document.documentType}`);
		}
		relativePaths.push(path.relative(WORKSPACE_ROOT, filePath));
	}
	await writeProofJson(packageDir, "response-package-summary.json", responsePackage);
	relativePaths.push(path.relative(WORKSPACE_ROOT, path.resolve(packageDir, "response-package-summary.json")));
	return relativePaths;
}

async function writeArtifacts(
	proof: LiveOpportunityResponseReadinessProof,
	disposition: EvidenceRecord["disposition"]
) {
	const rawPath = await writeProofJson(LOG_DIR, "live-opportunity-response-readiness.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001/F-005/F-020",
		journey: "J1/O1/O4",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source-kind:${proof.source.kind}`,
			`source:${proof.source.url}`,
			`opportunities:${proof.source.opportunityCount}`,
			`document-bytes:${proof.document?.byteLength ?? 0}`,
			`source-text:${proof.document?.extractedTextLength ?? 0}`,
			`docling-text:${proof.document?.extractedTextLength ?? 0}`,
			`docling-status:${proof.document?.doclingStatus ?? "not-run"}`,
			`source-extraction:${proof.document?.extractionMethod ?? "not-run"}`,
			`response-doc-types:${proof.responseReadiness?.documentTypes.length ?? 0}`,
			`pursuit-fit:${proof.responseReadiness?.pursuitFit.status ?? "not-run"}`,
			`pursuit-fit-score:${proof.responseReadiness?.pursuitFit.score ?? 0}`,
			`pursuit-recommendation:${proof.responseReadiness?.pursuitFit.recommendation ?? "not-run"}`,
			`source-requirements:${proof.responseReadiness?.sourceRequirementCount ?? 0}`,
			`evaluator-criteria:${proof.responseReadiness?.readiness.evaluationCriteriaIds.length ?? 0}`,
			`win-theme-seeds:${proof.responseReadiness?.winThemeSeedCount ?? 0}`,
			`response-draft-words:${proof.responseReadiness?.totalDraftWordCount ?? 0}`,
			`response-snippets:${proof.responseReadiness?.relevantSnippetCount ?? 0}`,
			`readiness:${proof.responseReadiness?.readiness.status ?? "not-run"}`,
			`readiness-warnings:${proof.responseReadiness?.readiness.warnings.length ?? 0}`,
			`readiness-missing-draft-criteria:${proof.responseReadiness?.readiness.missingDraftEvaluationCriteriaIds.length ?? 0}`,
			`readiness-missing-win-theme-criteria:${proof.responseReadiness?.readiness.missingWinThemeEvaluationCriteriaIds.length ?? 0}`,
			`readiness-source-coverage:${proof.responseReadiness?.readiness.metrics.sourceRequirementCoverage ?? 0}`,
			`readiness-win-theme-criteria-coverage:${proof.responseReadiness?.readiness.metrics.winThemeCriteriaCoverage ?? 0}`,
			`readiness-draft-artifact-integrity:${proof.responseReadiness?.readiness.metrics.draftArtifactIntegrityCoverage ?? 0}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe opportunity response readiness",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? `Live ${proof.source.kind} opportunity, source extraction, and concrete Datacraft response-package drafts were verified.`
			: proof.error ?? "Live opportunity response readiness proof failed.",
	}], {
		title: "Platform Live Opportunity Response Readiness Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
