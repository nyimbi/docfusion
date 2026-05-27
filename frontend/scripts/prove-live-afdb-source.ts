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
import { afdbParser, parseAfdbNoticeDetailMarkdown } from "@/lib/scrapers/parsers/afdb";
import { scrapeWithBrowserService } from "@/lib/services/browser-scraper-client";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID
	?? process.env.LIVE_AFDB_SOURCE_PROOF_RUN_ID
	?? createProofRunId("live_afdb_source");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-source-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-source-discovery-evidence.md");
const SOURCE_URL = process.env.LIVE_SOURCE_DISCOVERY_URL ?? "https://www.afdb.org/en/projects-and-operations/procurement";
const SCRAPE_TIMEOUT_MS = Number(process.env.LIVE_SOURCE_DISCOVERY_SCRAPE_TIMEOUT_MS ?? 60000);
const BROWSER_SCRAPER_URL = (process.env.STEALTH_SCRAPER_URL ?? "http://84.247.181.100:3003").replace(/\/$/, "");
const DETAIL_PROBE_LIMIT = 5;
const SOURCE_SCRAPE_ATTEMPTS = 3;

type AfdbParseResult = Awaited<ReturnType<typeof afdbParser.parse>>;

interface LiveAfdbSourceProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	source: {
		url: string;
		title?: string;
		markdownLength: number;
		linkCount: number;
		opportunityCount: number;
		scrapeMethod?: "firecrawl" | "browser_fallback";
		browserServiceUrl?: string;
		fallbackReason?: string;
		sampleOpportunities: Array<{
			title: string;
			noticeId?: string;
			countryRegion?: string;
			category?: string;
			portalUrl?: string;
		}>;
	};
	documentProbe?: {
		noticeTitle: string;
		noticeId?: string;
		portalUrl: string;
		documentUrl: string;
		documentLabel?: string;
		documentLinkCount: number;
	};
	error?: string;
}

interface AfdbSourceScrape {
	title?: string;
	markdown: string;
	links: string[];
	parsed: AfdbParseResult;
	scrapeMethod: "firecrawl" | "browser_fallback";
	browserServiceUrl?: string;
	fallbackReason?: string;
}

async function main() {
	const proof: LiveAfdbSourceProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		source: {
			url: SOURCE_URL,
			markdownLength: 0,
			linkCount: 0,
			opportunityCount: 0,
			sampleOpportunities: [],
		},
	};

	try {
		const client = new FirecrawlClient({ timeout: SCRAPE_TIMEOUT_MS });
		const sourceScrape = await scrapeAfdbSource(client);
		const { markdown, links, parsed } = sourceScrape;
		if (parsed.opportunities.length === 0) {
			throw new Error("AFDB parser returned no source opportunities");
		}
		if (parsed.opportunities.some((opportunity) => /\baward\b/i.test(opportunity.category ?? ""))) {
			throw new Error("AFDB parser returned award rows as active opportunity candidates");
		}

		proof.source = {
			url: SOURCE_URL,
			title: sourceScrape.title,
			markdownLength: markdown.trim().length,
			linkCount: links.length,
			opportunityCount: parsed.opportunities.length,
			scrapeMethod: sourceScrape.scrapeMethod,
			browserServiceUrl: sourceScrape.browserServiceUrl,
			fallbackReason: sourceScrape.fallbackReason,
			sampleOpportunities: parsed.opportunities.slice(0, 5).map((opportunity) => ({
				title: opportunity.title,
				noticeId: opportunity.noticeId ?? undefined,
				countryRegion: opportunity.countryRegion ?? undefined,
				category: opportunity.category ?? undefined,
				portalUrl: opportunity.portalUrl ?? undefined,
			})),
		};

		for (const opportunity of parsed.opportunities.slice(0, DETAIL_PROBE_LIMIT)) {
			if (!opportunity.portalUrl) continue;
			const detailResult = await client.scrape(opportunity.portalUrl, {
				formats: ["markdown", "links"],
				timeout: SCRAPE_TIMEOUT_MS,
			});
			if (!detailResult.success || !detailResult.data) continue;
			const detail = parseAfdbNoticeDetailMarkdown(
				detailResult.data.markdown,
				detailResult.data.links ?? [],
				opportunity.portalUrl
			);
			if (!detail.primaryLink) continue;
			proof.documentProbe = {
				noticeTitle: opportunity.title,
				noticeId: opportunity.noticeId ?? undefined,
				portalUrl: opportunity.portalUrl,
				documentUrl: detail.primaryLink.url,
				documentLabel: detail.primaryLink.description,
				documentLinkCount: detail.links.length,
			};
			break;
		}

		if (!proof.documentProbe) {
			throw new Error("AFDB detail pages did not expose a downloadable procurement document");
		}

		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function scrapeAfdbSource(client: FirecrawlClient): Promise<AfdbSourceScrape> {
	let fallbackReason = "Firecrawl returned no AFDB source content";
	for (let attempt = 1; attempt <= SOURCE_SCRAPE_ATTEMPTS; attempt += 1) {
		const sourceResult = await client.scrape(SOURCE_URL, {
			formats: ["markdown", "html", "links"],
			timeout: SCRAPE_TIMEOUT_MS,
		});
		const markdown = sourceResult.data?.markdown ?? sourceResult.data?.html ?? "";
		const links = sourceResult.data?.links ?? [];
		if (!sourceResult.success || markdown.trim().length === 0) {
			fallbackReason = sourceResult.error ?? `Firecrawl returned no AFDB source content on attempt ${attempt}`;
			continue;
		}

		const parsed = await afdbParser.parse({ markdown, links, url: SOURCE_URL });
		if (parsed.opportunities.length > 0) {
			return {
				title: sourceResult.data?.metadata?.title,
				markdown,
				links,
				parsed,
				scrapeMethod: "firecrawl",
				fallbackReason: attempt > 1 ? fallbackReason : undefined,
			};
		}
		fallbackReason = `Firecrawl returned AFDB content but the parser found no source opportunities on attempt ${attempt}`;
	}

	const fallback = await scrapeAfdbSourceWithBrowser(fallbackReason);
	const parsed = await afdbParser.parse({ markdown: fallback.markdown, links: fallback.links, url: SOURCE_URL });
	return {
		title: fallback.title,
		markdown: fallback.markdown,
		links: fallback.links,
		parsed,
		scrapeMethod: "browser_fallback",
		browserServiceUrl: BROWSER_SCRAPER_URL,
		fallbackReason,
	};
}

async function scrapeAfdbSourceWithBrowser(fallbackReason: string): Promise<{
	title?: string;
	markdown: string;
	links: string[];
}> {
	const result = await scrapeWithBrowserService(BROWSER_SCRAPER_URL, SOURCE_URL, {
		timeout: SCRAPE_TIMEOUT_MS,
		humanScroll: true,
		blockMedia: true,
	});
	const markdown = result.data?.markdown ?? result.data?.html ?? "";
	if (!result.success || markdown.trim().length === 0) {
		throw new Error(`${fallbackReason}; browser fallback failed: ${result.error ?? "no rendered content"}`);
	}
	return {
		title: result.data?.metadata?.title,
		markdown,
		links: result.data?.links ?? [],
	};
}

async function writeArtifacts(proof: LiveAfdbSourceProof, disposition: EvidenceRecord["disposition"]) {
	const rawPath = await writeProofJson(LOG_DIR, "live-afdb-source.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001",
		journey: "J1/O1",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source:${proof.source.url}`,
			`opportunities:${proof.source.opportunityCount}`,
			...(proof.source.scrapeMethod ? [`scrape:${proof.source.scrapeMethod}`] : []),
			...(proof.documentProbe ? [`document:${proof.documentProbe.documentUrl}`] : []),
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe AFDB source discovery",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live AFDB source scrape returned normalized opportunities and a downloadable procurement document from a detail page."
			: proof.error ?? "Live AFDB source discovery proof failed.",
	}], {
		title: "Platform Live Source Discovery Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
