import "./load-env";

import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { FirecrawlClient } from "@/lib/scrapers/firecrawl";
import { scrapeWithBrowserService } from "@/lib/services/browser-scraper-client";
import { checkSearxngHealth, searchSearxng, type SearxngResult } from "@/lib/services/searxng-client";
import { fetchUngmOpportunities } from "@/lib/services/ungm-client";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_DISCOVERY_PROOF_RUN_ID ?? createProofRunId("live_discovery");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-discovery-evidence.md");
const DEFAULT_SEARXNG_QUERIES = [
	"tenders.go.ke",
	"ungm.org",
	"procurement-notices.undp.org",
	"Kenya ICT tender procurement RFP",
];
const DEFAULT_SEARXNG_ENGINES = ["bing"];
const SEARXNG_QUERIES = parseSearxngQueries();
const SEARXNG_ENGINES = parseSearxngEngines();
const SCRAPE_TIMEOUT_MS = Number(process.env.LIVE_DISCOVERY_SCRAPE_TIMEOUT_MS ?? 60000);
const FIRECRAWL_SCRAPE_URL = process.env.LIVE_DISCOVERY_FIRECRAWL_URL
	?? process.env.LIVE_DISCOVERY_SCRAPE_URL
	?? "https://procurement-notices.undp.org";
const BROWSER_SCRAPE_URL = process.env.LIVE_DISCOVERY_BROWSER_URL
	?? process.env.LIVE_DISCOVERY_SCRAPE_URL
	?? "https://www.ungm.org/Public/Notice?title=software";
const BROWSER_SCRAPER_URL = (process.env.STEALTH_SCRAPER_URL ?? "http://84.247.181.100:3003").replace(/\/$/, "");

const OPPORTUNITY_SOURCE_HOSTS = [
	"tenders.go.ke",
	"procurement-notices.undp.org",
	"ungm.org",
];
const OPPORTUNITY_ACTION_KEYWORDS = [
	"bid",
	"bidding",
	"eoi",
	"expression of interest",
	"invitation to tender",
	"notice",
	"request for proposal",
	"request for quotation",
	"rfp",
	"solicitation",
	"tender",
	"tenders",
];
const OPPORTUNITY_CONTEXT_KEYWORDS = [
	"contract",
	"e-procurement",
	"procurement",
	"public notice",
	"public procurement",
	"tender notice",
];
const NON_OPPORTUNITY_HOSTS = [
	"dictionary.cambridge.org",
	"merriam-webster.com",
	"investopedia.com",
	"tinder.com",
	"wikipedia.org",
];
const SCRAPE_PROCUREMENT_INDICATORS = [
	"bid",
	"deadline",
	"invitation to bid",
	"procurement",
	"procurement notice",
	"request for proposal",
	"rfp",
	"solicitation",
	"tender",
	"undp",
];
const SAMPLE_LIMIT = 5;

interface OpportunityEvidenceLink {
	url: string;
	host: string;
	label: string;
}

interface ScrapeOpportunityEvidence {
	sourceHost: string;
	sampleLinks: OpportunityEvidenceLink[];
	sampleOpportunitySnippets: string[];
	opportunitySnippetCount: number;
}

interface ResolvedBrowserTarget {
	url: string;
	sourceUrl?: string;
	searchUrl?: string;
	selectedOpportunity?: {
		title: string;
		sourceId?: string;
		organization?: string;
		deadline?: string;
	};
}

interface LiveDiscoveryProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	searxng?: {
		healthy: boolean;
		query: string;
		engines: string[];
		queriesTried: string[];
		resultCount: number;
		totalResultCount: number;
		opportunityResultCount: number;
		sampleResults: Array<{ title: string; url: string; engine: string }>;
	};
	firecrawl?: {
		url: string;
		success: boolean;
		title?: string;
		markdownLength: number;
		procurementIndicators: string[];
		procurementIndicatorCount: number;
		opportunityEvidence: ScrapeOpportunityEvidence;
		error?: string;
	};
	browserFallback?: {
		url: string;
		sourceUrl?: string;
		searchUrl?: string;
		serviceUrl: string;
		success: boolean;
		title?: string;
		markdownLength: number;
		procurementIndicators: string[];
		procurementIndicatorCount: number;
		opportunityEvidence: ScrapeOpportunityEvidence;
		selectedOpportunity?: ResolvedBrowserTarget["selectedOpportunity"];
		error?: string;
	};
	error?: string;
}

async function main() {
	const proof: LiveDiscoveryProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
	};

	try {
		proof.searxng = await proveSearxng();
		proof.firecrawl = await proveFirecrawl();
		proof.browserFallback = await proveBrowserFallback();
		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function proveSearxng(): Promise<NonNullable<LiveDiscoveryProof["searxng"]>> {
	const healthy = await checkSearxngHealth();
	if (!healthy) {
		throw new Error("SearXNG health/search probe failed");
	}

	const attempts: Array<{
		query: string;
		results: SearxngResult[];
		opportunityResults: SearxngResult[];
	}> = [];
	for (const query of SEARXNG_QUERIES) {
		const response = await searchSearxng(query, {
			engines: SEARXNG_ENGINES,
			language: "en",
			safesearch: 1,
		});
		const opportunityResults = response.results.filter(isOpportunityResult);
		attempts.push({ query, results: response.results, opportunityResults });
		if (opportunityResults.length > 0) {
			break;
		}
	}

	const successfulAttempt = attempts.find((attempt) => attempt.opportunityResults.length > 0);
	if (!successfulAttempt) {
		const summary = attempts
			.map((attempt) => `${attempt.query}: ${attempt.results.length} results, 0 opportunity-relevant`)
			.join("; ");
		throw new Error(`SearXNG returned no opportunity-relevant results (${summary})`);
	}

	return {
		healthy,
		query: successfulAttempt.query,
		engines: SEARXNG_ENGINES,
		queriesTried: attempts.map((attempt) => attempt.query),
		resultCount: successfulAttempt.opportunityResults.length,
		totalResultCount: successfulAttempt.results.length,
		opportunityResultCount: successfulAttempt.opportunityResults.length,
		sampleResults: successfulAttempt.opportunityResults.slice(0, 5).map((result) => ({
			title: result.title,
			url: result.url,
			engine: result.engine,
		})),
	};
}

function parseSearxngQueries(): string[] {
	const configuredQuery = process.env.LIVE_DISCOVERY_SEARXNG_QUERY?.trim();
	if (configuredQuery) {
		return [configuredQuery];
	}

	const configuredQueries = process.env.LIVE_DISCOVERY_SEARXNG_QUERIES?.split(/\r?\n|\s*\|\|\s*/u)
		.map((query) => query.trim())
		.filter(Boolean);
	return configuredQueries?.length ? configuredQueries : DEFAULT_SEARXNG_QUERIES;
}

function parseSearxngEngines(): string[] {
	const configuredEngines = process.env.LIVE_DISCOVERY_SEARXNG_ENGINES?.split(",")
		.map((engine) => engine.trim())
		.filter(Boolean);
	return configuredEngines?.length ? configuredEngines : DEFAULT_SEARXNG_ENGINES;
}

function isOpportunityResult(result: SearxngResult): boolean {
	const url = result.url.toLowerCase();
	if (NON_OPPORTUNITY_HOSTS.some((host) => url.includes(host))) {
		return false;
	}
	if (OPPORTUNITY_SOURCE_HOSTS.some((host) => url.includes(host))) {
		return true;
	}

	const haystack = `${result.title} ${result.content} ${result.url}`.toLowerCase();
	return OPPORTUNITY_ACTION_KEYWORDS.some((keyword) => haystack.includes(keyword))
		&& OPPORTUNITY_CONTEXT_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

async function proveFirecrawl(): Promise<NonNullable<LiveDiscoveryProof["firecrawl"]>> {
	const client = new FirecrawlClient({ timeout: SCRAPE_TIMEOUT_MS });
	const result = await client.scrape(FIRECRAWL_SCRAPE_URL, {
		formats: ["markdown", "html", "links"],
		timeout: SCRAPE_TIMEOUT_MS,
	});
	const markdown = result.data?.markdown?.trim() ?? "";
	const markdownLength = markdown.length;
	if (!result.success || markdownLength === 0) {
		throw new Error(result.error ?? "Firecrawl returned no markdown content");
	}
	const procurementIndicators = procurementIndicatorsFor(markdown);
	if (procurementIndicators.length === 0) {
		throw new Error("Firecrawl returned content without procurement opportunity indicators");
	}
	const opportunityEvidence = buildScrapeOpportunityEvidence({
		sourceUrl: FIRECRAWL_SCRAPE_URL,
		markdown,
		html: result.data?.html,
		links: result.data?.links,
	});
	if (opportunityEvidence.opportunitySnippetCount === 0) {
		throw new Error("Firecrawl returned procurement indicators but no actionable opportunity snippets");
	}

	return {
		url: FIRECRAWL_SCRAPE_URL,
		success: true,
		title: result.data?.metadata?.title,
		markdownLength,
		procurementIndicators,
		procurementIndicatorCount: procurementIndicators.length,
		opportunityEvidence,
	};
}

async function proveBrowserFallback(): Promise<NonNullable<LiveDiscoveryProof["browserFallback"]>> {
	const targets = await resolveBrowserScrapeTargets();
	const errors: string[] = [];
	for (const target of targets) {
		const result = await scrapeWithBrowserService(BROWSER_SCRAPER_URL, target.url, {
			timeout: SCRAPE_TIMEOUT_MS,
			humanScroll: true,
			blockMedia: true,
			formats: ["markdown", "html", "links"],
		});
		const markdown = result.data?.markdown?.trim() ?? "";
		const markdownLength = markdown.length;
		if (!result.success || markdownLength === 0) {
			errors.push(`${target.url}: ${result.error ?? "Browser scraper returned no markdown content"}`);
			continue;
		}
		const procurementIndicators = procurementIndicatorsFor(markdown);
		if (procurementIndicators.length === 0) {
			errors.push(`${target.url}: Browser scraper returned content without procurement opportunity indicators`);
			continue;
		}
		const opportunityEvidence = buildScrapeOpportunityEvidence({
			sourceUrl: target.url,
			markdown,
			html: result.data?.html,
			links: result.data?.links,
		});
		if (opportunityEvidence.opportunitySnippetCount === 0) {
			errors.push(`${target.url}: Browser scraper returned procurement indicators but no actionable opportunity snippets`);
			continue;
		}

		return {
			url: target.url,
			sourceUrl: target.sourceUrl,
			searchUrl: target.searchUrl,
			serviceUrl: BROWSER_SCRAPER_URL,
			success: true,
			title: result.data?.metadata?.title,
			markdownLength,
			procurementIndicators,
			procurementIndicatorCount: procurementIndicators.length,
			opportunityEvidence,
			selectedOpportunity: target.selectedOpportunity,
		};
	}

	throw new Error(errors.join("; ") || "Browser scraper returned no usable procurement content");
}

async function resolveBrowserScrapeTargets(): Promise<ResolvedBrowserTarget[]> {
	if (!isUngmSearchUrl(BROWSER_SCRAPE_URL)) {
		return [{ url: BROWSER_SCRAPE_URL }];
	}

	const result = await fetchUngmOpportunities(BROWSER_SCRAPE_URL, {
		limit: 5,
		timeoutMs: 20000,
	});
	const targets = result.opportunities
		.filter((candidate) => candidate.portalUrl)
		.slice(0, 3)
		.map((opportunity) => ({
			url: opportunity.portalUrl as string,
			sourceUrl: BROWSER_SCRAPE_URL,
			searchUrl: result.searchUrl,
			selectedOpportunity: {
				title: opportunity.title,
				sourceId: opportunity.sourceId ?? undefined,
				organization: opportunity.organization ?? undefined,
				deadline: opportunity.deadline instanceof Date
					? opportunity.deadline.toISOString()
					: opportunity.deadline ?? undefined,
			},
		}));
	if (targets.length === 0) {
		throw new Error("UNGM browser target search returned no current opportunity portal URL");
	}

	return [
		...targets,
		{ url: BROWSER_SCRAPE_URL, searchUrl: result.searchUrl },
	];
}

function isUngmSearchUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./, "").toLowerCase() === "ungm.org"
			&& parsed.pathname.toLowerCase() === "/public/notice";
	} catch {
		return false;
	}
}

function procurementIndicatorsFor(markdown: string): string[] {
	const haystack = markdown.toLowerCase();
	return SCRAPE_PROCUREMENT_INDICATORS.filter((indicator) => haystack.includes(indicator));
}

function buildScrapeOpportunityEvidence(input: {
	sourceUrl: string;
	markdown: string;
	html?: string;
	links?: string[];
}): ScrapeOpportunityEvidence {
	const sourceHost = sourceHostFor(input.sourceUrl);
	const sampleOpportunitySnippets = extractOpportunitySnippets(input.markdown);

	return {
		sourceHost,
		sampleLinks: extractSampleLinks(input),
		sampleOpportunitySnippets,
		opportunitySnippetCount: sampleOpportunitySnippets.length,
	};
}

function sourceHostFor(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		return "unknown";
	}
}

function extractOpportunitySnippets(markdown: string): string[] {
	const snippets: string[] = [];
	const seen = new Set<string>();
	for (const rawLine of markdown.split(/\r?\n/u)) {
		const snippet = normalizeSnippet(rawLine);
		if (!isUsableOpportunitySnippet(snippet)) {
			continue;
		}
		addSnippet(snippets, seen, snippet);
	}
	if (snippets.length < SAMPLE_LIMIT) {
		for (const snippet of extractContextSnippets(markdown)) {
			addSnippet(snippets, seen, snippet);
			if (snippets.length >= SAMPLE_LIMIT) {
				break;
			}
		}
	}
	return snippets;
}

function normalizeSnippet(value: string): string {
	return value
		.replace(/<[^>]+>/gu, " ")
		.replace(/&nbsp;/giu, " ")
		.replace(/&amp;/giu, "&")
		.replace(/\s+/gu, " ")
		.replace(/^[-*#>\s]+/u, "")
		.trim();
}

function isUsableOpportunitySnippet(snippet: string): boolean {
	if (snippet.length < 20 || isStaticAssetReference(snippet) || isScriptConfigurationLine(snippet)) {
		return false;
	}
	const lower = snippet.toLowerCase();
	if (OPPORTUNITY_ACTION_KEYWORDS.some((keyword) => lower === keyword)) {
		return false;
	}
	if (!OPPORTUNITY_ACTION_KEYWORDS.some((keyword) => lower.includes(keyword))) {
		return false;
	}
	return OPPORTUNITY_CONTEXT_KEYWORDS.some((keyword) => lower.includes(keyword))
		|| SCRAPE_PROCUREMENT_INDICATORS.some((indicator) => lower.includes(indicator));
}

function addSnippet(snippets: string[], seen: Set<string>, snippet: string) {
	const key = snippet.toLowerCase().slice(0, 180);
	if (seen.has(key) || snippets.length >= SAMPLE_LIMIT) {
		return;
	}
	seen.add(key);
	snippets.push(snippet.slice(0, 240));
}

function extractContextSnippets(markdown: string): string[] {
	const text = normalizeSnippet(markdown);
	const snippets: string[] = [];
	const seen = new Set<string>();
	for (const keyword of [...OPPORTUNITY_ACTION_KEYWORDS].sort((left, right) => right.length - left.length)) {
		const pattern = new RegExp(escapeRegExp(keyword), "giu");
		for (const match of text.matchAll(pattern)) {
			const index = match.index ?? 0;
			const snippet = normalizeSnippet(text.slice(Math.max(0, index - 90), Math.min(text.length, index + 170)));
			if (!isUsableOpportunitySnippet(snippet)) {
				continue;
			}
			addSnippet(snippets, seen, snippet);
			if (snippets.length >= SAMPLE_LIMIT) {
				return snippets;
			}
		}
	}
	return snippets;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function extractSampleLinks(input: {
	sourceUrl: string;
	markdown: string;
	html?: string;
	links?: string[];
}): OpportunityEvidenceLink[] {
	const candidates = [
		...(input.links ?? []),
		...extractInlineLinks(input.markdown),
		...extractInlineLinks(input.html ?? ""),
	];
	const seen = new Set<string>();
	const normalizedCandidates: Array<{ index: number; score: number; url: string; host: string }> = [];
	for (const [index, candidate] of candidates.entries()) {
		const normalized = normalizeEvidenceUrl(candidate, input.sourceUrl);
		if (!normalized || seen.has(normalized)) {
			continue;
		}
		const host = sourceHostFor(normalized);
		if (!isOpportunityEvidenceUrl(normalized, host)) {
			continue;
		}
		seen.add(normalized);
		normalizedCandidates.push({
			index,
			score: opportunityEvidenceUrlScore(normalized, host),
			url: normalized,
			host,
		});
	}

	const sampleLinks: OpportunityEvidenceLink[] = [];
	for (const candidate of normalizedCandidates.sort((left, right) => right.score - left.score || left.index - right.index)) {
		sampleLinks.push({
			url: candidate.url,
			host: candidate.host,
			label: evidenceLinkLabel(candidate.url),
		});
		if (sampleLinks.length >= SAMPLE_LIMIT) {
			break;
		}
	}
	return sampleLinks;
}

function extractInlineLinks(content: string): string[] {
	return [
		...[...content.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/giu)].map((match) => match[1]),
		...[...content.matchAll(/\bhref=["']([^"']+)["']/giu)].map((match) => match[1]),
		...[...content.matchAll(/\bhttps?:\/\/[^\s<>"')]+/giu)].map((match) => match[0]),
	].filter((value): value is string => Boolean(value));
}

function normalizeEvidenceUrl(candidate: string, sourceUrl: string): string | undefined {
	try {
		return new URL(candidate, sourceUrl).toString();
	} catch {
		return undefined;
	}
}

function opportunityEvidenceUrlScore(url: string, host: string): number {
	const parsed = new URL(url);
	const pathname = parsed.pathname.toLowerCase();
	if (/\.(pdf|docx?|xlsx?)$/iu.test(pathname)) {
		return 100;
	}
	if (host === "procurement-notices.undp.org" && pathname.includes("view_negotiation")) {
		return 90;
	}
	if (host === "ungm.org" && /^\/public\/notice\/\d+/iu.test(pathname)) {
		return 90;
	}
	if (host === "tenders.go.ke" && pathname.includes("tenders")) {
		return 80;
	}
	if (host === "ungm.org" && pathname.startsWith("/public/notice")) {
		return 50;
	}
	return 10;
}

function isOpportunityEvidenceUrl(url: string, host: string): boolean {
	if (isStaticAssetReference(url)) {
		return false;
	}
	const parsed = new URL(url);
	const pathname = parsed.pathname.toLowerCase();
	if (/\.(pdf|docx?|xlsx?)$/iu.test(pathname)) {
		return true;
	}
	if (host === "procurement-notices.undp.org" && pathname.includes("view_negotiation")) {
		return true;
	}
	if (host === "ungm.org" && pathname.startsWith("/public/notice")) {
		return true;
	}
	if (host === "tenders.go.ke" && pathname.includes("tenders")) {
		return true;
	}

	const haystack = url.toLowerCase();
	return OPPORTUNITY_ACTION_KEYWORDS.some((keyword) => haystack.includes(keyword.replace(/\s+/gu, "-")))
		&& OPPORTUNITY_CONTEXT_KEYWORDS.some((keyword) => haystack.includes(keyword.replace(/\s+/gu, "-")));
}

function isStaticAssetReference(value: string): boolean {
	return /\.(?:avif|css|gif|ico|jpe?g|js|png|svg|webp|woff2?)(?:$|[?#)\s])/iu.test(value);
}

function isScriptConfigurationLine(value: string): boolean {
	return /(?:selector|eoifailure|subscribetitle|subscribemessage|buttontext|has failed.*helpdesk|function\s*\(|var\s+|const\s+|let\s+|=>)/iu.test(value);
}

function evidenceLinkLabel(url: string): string {
	try {
		const parsed = new URL(url);
		const finalSegment = parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.hostname;
		return decodeURIComponent(finalSegment).replace(/[-_]+/gu, " ").slice(0, 80);
	} catch {
		return url.slice(0, 80);
	}
}

async function writeArtifacts(proof: LiveDiscoveryProof, disposition: EvidenceRecord["disposition"]) {
	const rawPath = await writeProofJson(LOG_DIR, "live-discovery-services.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001",
		journey: "J1/O1",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`searxng-opportunities:${proof.searxng?.opportunityResultCount ?? 0}`,
			`searxng-total:${proof.searxng?.totalResultCount ?? 0}`,
			`firecrawl:${proof.firecrawl?.markdownLength ?? 0}`,
			`firecrawl-procurement-indicators:${proof.firecrawl?.procurementIndicatorCount ?? 0}`,
			`firecrawl-source-host:${proof.firecrawl?.opportunityEvidence.sourceHost ?? "unknown"}`,
			`firecrawl-opportunity-snippets:${proof.firecrawl?.opportunityEvidence.opportunitySnippetCount ?? 0}`,
			`firecrawl-sample-links:${proof.firecrawl?.opportunityEvidence.sampleLinks.length ?? 0}`,
			`browser:${proof.browserFallback?.markdownLength ?? 0}`,
			`browser-procurement-indicators:${proof.browserFallback?.procurementIndicatorCount ?? 0}`,
			`browser-source-host:${proof.browserFallback?.opportunityEvidence.sourceHost ?? "unknown"}`,
			`browser-opportunity-snippets:${proof.browserFallback?.opportunityEvidence.opportunitySnippetCount ?? 0}`,
			`browser-sample-links:${proof.browserFallback?.opportunityEvidence.sampleLinks.length ?? 0}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe search + scrape",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live SearXNG search returned opportunity-relevant results; Firecrawl and browser fallback returned procurement-source content."
			: proof.error ?? "Live discovery service proof failed.",
	}], {
		title: "Platform Live Discovery Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
