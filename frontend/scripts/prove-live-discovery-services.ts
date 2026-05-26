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
import { checkSearxngHealth, searchSearxng } from "@/lib/services/searxng-client";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_DISCOVERY_PROOF_RUN_ID ?? createProofRunId("live_discovery");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-discovery-evidence.md");
const SEARXNG_QUERY = process.env.LIVE_DISCOVERY_SEARXNG_QUERY ?? "tender";
const FIRECRAWL_URL = process.env.LIVE_DISCOVERY_FIRECRAWL_URL ?? "https://example.com";
const BROWSER_SCRAPER_URL = (process.env.STEALTH_SCRAPER_URL ?? "http://84.247.181.100:3003").replace(/\/$/, "");

interface LiveDiscoveryProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	searxng?: {
		healthy: boolean;
		query: string;
		resultCount: number;
		sampleResults: Array<{ title: string; url: string; engine: string }>;
	};
	firecrawl?: {
		url: string;
		success: boolean;
		title?: string;
		markdownLength: number;
		error?: string;
	};
	browserFallback?: {
		url: string;
		serviceUrl: string;
		success: boolean;
		title?: string;
		markdownLength: number;
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

	const results = await searchSearxng(SEARXNG_QUERY, {
		language: "en",
		safesearch: 1,
	});
	if (!results.results.length) {
		throw new Error(`SearXNG returned no results for ${SEARXNG_QUERY}`);
	}

	return {
		healthy,
		query: SEARXNG_QUERY,
		resultCount: results.results.length,
		sampleResults: results.results.slice(0, 5).map((result) => ({
			title: result.title,
			url: result.url,
			engine: result.engine,
		})),
	};
}

async function proveFirecrawl(): Promise<NonNullable<LiveDiscoveryProof["firecrawl"]>> {
	const client = new FirecrawlClient({ timeout: 20000 });
	const result = await client.scrape(FIRECRAWL_URL, {
		formats: ["markdown", "html"],
		timeout: 20000,
	});
	const markdownLength = result.data?.markdown?.trim().length ?? 0;
	if (!result.success || markdownLength === 0) {
		throw new Error(result.error ?? "Firecrawl returned no markdown content");
	}

	return {
		url: FIRECRAWL_URL,
		success: true,
		title: result.data?.metadata?.title,
		markdownLength,
	};
}

async function proveBrowserFallback(): Promise<NonNullable<LiveDiscoveryProof["browserFallback"]>> {
	const result = await scrapeWithBrowserService(BROWSER_SCRAPER_URL, FIRECRAWL_URL, {
		timeout: 20000,
		humanScroll: true,
		blockMedia: true,
	});
	const markdownLength = result.data?.markdown?.trim().length ?? 0;
	if (!result.success || markdownLength === 0) {
		throw new Error(result.error ?? "Browser scraper returned no markdown content");
	}

	return {
		url: FIRECRAWL_URL,
		serviceUrl: BROWSER_SCRAPER_URL,
		success: true,
		title: result.data?.metadata?.title,
		markdownLength,
	};
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
			`searxng:${proof.searxng?.resultCount ?? 0}`,
			`firecrawl:${proof.firecrawl?.markdownLength ?? 0}`,
			`browser:${proof.browserFallback?.markdownLength ?? 0}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe search + scrape",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live SearXNG search, Firecrawl scrape, and browser fallback scrape returned usable content."
			: proof.error ?? "Live discovery service proof failed.",
	}], {
		title: "Platform Live Discovery Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
