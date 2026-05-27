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
		error?: string;
	};
	browserFallback?: {
		url: string;
		serviceUrl: string;
		success: boolean;
		title?: string;
		markdownLength: number;
		procurementIndicators: string[];
		procurementIndicatorCount: number;
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
		formats: ["markdown", "html"],
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

	return {
		url: FIRECRAWL_SCRAPE_URL,
		success: true,
		title: result.data?.metadata?.title,
		markdownLength,
		procurementIndicators,
		procurementIndicatorCount: procurementIndicators.length,
	};
}

async function proveBrowserFallback(): Promise<NonNullable<LiveDiscoveryProof["browserFallback"]>> {
	const result = await scrapeWithBrowserService(BROWSER_SCRAPER_URL, BROWSER_SCRAPE_URL, {
		timeout: SCRAPE_TIMEOUT_MS,
		humanScroll: true,
		blockMedia: true,
	});
	const markdown = result.data?.markdown?.trim() ?? "";
	const markdownLength = markdown.length;
	if (!result.success || markdownLength === 0) {
		throw new Error(result.error ?? "Browser scraper returned no markdown content");
	}
	const procurementIndicators = procurementIndicatorsFor(markdown);
	if (procurementIndicators.length === 0) {
		throw new Error("Browser scraper returned content without procurement opportunity indicators");
	}

	return {
		url: BROWSER_SCRAPE_URL,
		serviceUrl: BROWSER_SCRAPER_URL,
		success: true,
		title: result.data?.metadata?.title,
		markdownLength,
		procurementIndicators,
		procurementIndicatorCount: procurementIndicators.length,
	};
}

function procurementIndicatorsFor(markdown: string): string[] {
	const haystack = markdown.toLowerCase();
	return SCRAPE_PROCUREMENT_INDICATORS.filter((indicator) => haystack.includes(indicator));
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
			`browser:${proof.browserFallback?.markdownLength ?? 0}`,
			`browser-procurement-indicators:${proof.browserFallback?.procurementIndicatorCount ?? 0}`,
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
