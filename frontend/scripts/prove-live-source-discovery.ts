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
import { genericParser, getParser } from "@/lib/scrapers/parsers";
import { scrapeWithBrowserService } from "@/lib/services/browser-scraper-client";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID
	?? createProofRunId(process.env.LIVE_SOURCE_DISCOVERY_PROOF_PREFIX ?? "live_source_discovery");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-source-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-source-discovery-evidence.md");
const SOURCE_URL = process.env.LIVE_SOURCE_DISCOVERY_URL ?? "https://procurement-notices.undp.org";
const SCRAPE_TIMEOUT_MS = Number(process.env.LIVE_SOURCE_DISCOVERY_SCRAPE_TIMEOUT_MS ?? 60000);
const BROWSER_SCRAPER_URL = (process.env.STEALTH_SCRAPER_URL ?? "http://84.247.181.100:3003").replace(/\/$/, "");

interface LiveSourceDiscoveryProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	source: {
		url: string;
		title?: string;
		markdownLength: number;
		linkCount: number;
		opportunityCount: number;
		scrapeMethod: "firecrawl" | "browser_fallback" | "source_api";
		browserServiceUrl?: string;
		fallbackReason?: string;
		sampleOpportunities: Array<{
			title: string;
			noticeId?: string;
			organization?: string;
			countryRegion?: string;
			portalUrl?: string;
		}>;
	};
	error?: string;
}

async function main() {
	const proof: LiveSourceDiscoveryProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		source: {
			url: SOURCE_URL,
			markdownLength: 0,
			linkCount: 0,
			opportunityCount: 0,
			scrapeMethod: "firecrawl",
			sampleOpportunities: [],
		},
	};

	try {
		proof.source = await proveConfiguredSource();
		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function proveConfiguredSource(): Promise<LiveSourceDiscoveryProof["source"]> {
	const parser = parserForSourceUrl(SOURCE_URL);
	if (isSourceApiParser(parser)) {
		const parsed = await parser.parse({ url: SOURCE_URL });
		return sourceProofFromParsed({
			parsed,
			title: parser.name,
			markdown: "",
			links: [],
			scrapeMethod: "source_api",
		});
	}

	const client = new FirecrawlClient({ timeout: SCRAPE_TIMEOUT_MS });
	const result = await client.scrape(SOURCE_URL, {
		formats: ["markdown", "html", "links"],
		timeout: SCRAPE_TIMEOUT_MS,
	});
	let markdown = result.data?.markdown ?? result.data?.html ?? "";
	let html = result.data?.html ?? "";
	let links = result.data?.links ?? [];
	let title = result.data?.metadata?.title;
	let scrapeMethod: "firecrawl" | "browser_fallback" = "firecrawl";
	let browserServiceUrl: string | undefined;
	let fallbackReason: string | undefined;

	if (!result.success || markdown.trim().length === 0) {
		fallbackReason = result.error ?? "Firecrawl returned no configured source content";
		const fallback = await scrapeConfiguredSourceWithBrowser(fallbackReason);
		markdown = fallback.markdown;
		html = fallback.html;
		links = fallback.links;
		title = fallback.title;
		scrapeMethod = "browser_fallback";
		browserServiceUrl = BROWSER_SCRAPER_URL;
	}

	let parsed = await parser.parse({
		html,
		markdown,
		links,
		url: SOURCE_URL,
	});
	if (parsed.opportunities.length === 0 && scrapeMethod === "firecrawl") {
		fallbackReason = `Firecrawl returned content but ${parser.name} found no source opportunities`;
		const fallback = await scrapeConfiguredSourceWithBrowser(fallbackReason);
		markdown = fallback.markdown;
		html = fallback.html;
		links = fallback.links;
		title = fallback.title;
		scrapeMethod = "browser_fallback";
		browserServiceUrl = BROWSER_SCRAPER_URL;
		parsed = await parser.parse({
			html,
			markdown,
			links,
			url: SOURCE_URL,
		});
	}
	return sourceProofFromParsed({
		parsed,
		title,
		markdown,
		links,
		scrapeMethod,
		browserServiceUrl,
		fallbackReason,
	});
}

function sourceProofFromParsed(input: {
	parsed: Awaited<ReturnType<ReturnType<typeof parserForSourceUrl>["parse"]>>;
	title?: string;
	markdown: string;
	links: string[];
	scrapeMethod: LiveSourceDiscoveryProof["source"]["scrapeMethod"];
	browserServiceUrl?: string;
	fallbackReason?: string;
}): LiveSourceDiscoveryProof["source"] {
	if (input.parsed.opportunities.length === 0) {
		throw new Error("Configured tender parser returned no source opportunities");
	}

	const firstTitle = input.parsed.opportunities[0]?.title ?? "";
	if (firstTitle.trim().length === 0) {
		throw new Error("Source opportunity title was empty after normalization");
	}
	if (/\b(Title|Ref No|Deadline|Posted)\b/i.test(firstTitle)) {
		throw new Error(`Source opportunity title was not normalized: ${firstTitle}`);
	}
	const malformedCountry = input.parsed.opportunities
		.slice(0, 5)
		.find((opportunity) => /<br|https?:\/\//i.test(String(opportunity.countryRegion ?? "")));
	if (malformedCountry) {
		throw new Error(`Source opportunity country was not normalized: ${malformedCountry.countryRegion}`);
	}

	return {
		url: SOURCE_URL,
		title: input.title,
		markdownLength: input.markdown.trim().length,
		linkCount: input.links.length,
		opportunityCount: input.parsed.opportunities.length,
		scrapeMethod: input.scrapeMethod,
		browserServiceUrl: input.browserServiceUrl,
		fallbackReason: input.fallbackReason,
		sampleOpportunities: input.parsed.opportunities.slice(0, 5).map((opportunity) => ({
			title: opportunity.title,
			noticeId: opportunity.noticeId ?? undefined,
			organization: opportunity.organization ?? undefined,
			countryRegion: opportunity.countryRegion ?? undefined,
			portalUrl: opportunity.portalUrl ?? undefined,
		})),
	};
}

async function scrapeConfiguredSourceWithBrowser(fallbackReason: string): Promise<{
	title?: string;
	markdown: string;
	html: string;
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
		html: result.data?.html ?? markdown,
		links: result.data?.links ?? [],
	};
}

function parserForSourceUrl(sourceUrl: string) {
	const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
	if (host.includes("afdb.org")) return getParser("afdb") ?? genericParser;
	if (host.includes("adb.org")) return getParser("adb") ?? genericParser;
	if (host.includes("aiib.org") && new URL(sourceUrl).pathname.includes("/project-procurement/")) return getParser("aiib") ?? genericParser;
	if (host.includes("comesa.int")) return getParser("comesa") ?? genericParser;
	if (host.includes("tenders.go.ke")) return getParser("kenya_ppip") ?? genericParser;
	if (host === "un.org" && new URL(sourceUrl).pathname.startsWith("/procurement/")) return getParser("un_procurement") ?? genericParser;
	if (host.includes("iom.int") && new URL(sourceUrl).pathname.startsWith("/procurement-opportunities")) return getParser("iom") ?? genericParser;
	if (host.includes("unicef.org")) return getParser("unicef") ?? genericParser;
	if (host.includes("procurement-notices.undp.org")) return getParser("undp") ?? genericParser;
	if (host.includes("ungm.org")) return getParser("ungm") ?? genericParser;
	if (host.includes("worldbank.org")) return getParser("world_bank") ?? genericParser;
	if (host.includes("caribank.org") && new URL(sourceUrl).pathname.startsWith("/work-with-us/procurement/")) return getParser("cdb") ?? genericParser;
	if (host.includes("ebrd.com")) return getParser("ebrd") ?? genericParser;
	if (host.includes("sam.gov")) return getParser("sam_gov") ?? genericParser;
	if (host.includes("ec.europa.eu") && sourceUrl.includes("funding-tenders")) return getParser("eu_funding_tenders") ?? genericParser;
	if (host.includes("dgmarket.com")) return getParser("dgmarket") ?? genericParser;
	if (host.includes("giz.de") && new URL(sourceUrl).pathname.endsWith("/tenders")) return getParser("giz") ?? genericParser;
	if (host === "ocds-api.etenders.gov.za" && new URL(sourceUrl).pathname.startsWith("/api/OCDSReleases")) return getParser("etenders_sa") ?? genericParser;
	if (host === "nest.go.tz" && new URL(sourceUrl).pathname.includes("/nest-data-portal-api/api/releases")) return getParser("nest_tanzania") ?? genericParser;
	if (host === "umucyo.gov.rw" && new URL(sourceUrl).pathname.startsWith("/eb/bav/selectListAdvertisingListForGU.do")) return getParser("umucyo_rwanda") ?? genericParser;
	if (host === "ghaneps.gov.gh" && new URL(sourceUrl).pathname.startsWith("/epps/quickSearchAction.do")) return getParser("ghaneps") ?? genericParser;
	return genericParser;
}

function isSourceApiParser(parser: ReturnType<typeof parserForSourceUrl>): boolean {
	return parser.sourceId === "sam_gov"
		|| parser.sourceId === "eu_funding_tenders"
		|| parser.sourceId === "adb"
		|| parser.sourceId === "aiib"
		|| parser.sourceId === "world_bank"
		|| parser.sourceId === "cdb"
		|| parser.sourceId === "iom"
		|| parser.sourceId === "nest_tanzania"
		|| parser.sourceId === "umucyo_rwanda"
		|| parser.sourceId === "ghaneps"
		|| parser.sourceId === "etenders_sa";
}

async function writeArtifacts(proof: LiveSourceDiscoveryProof, disposition: EvidenceRecord["disposition"]) {
	const rawPath = await writeProofJson(LOG_DIR, "live-source-discovery.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001",
		journey: "J1/O1",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source:${proof.source.url}`,
			`opportunities:${proof.source.opportunityCount}`,
			`scrape:${proof.source.scrapeMethod}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe configured source discovery",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? `Live configured source ${proof.source.scrapeMethod} scrape returned parsed and normalized opportunity candidates.`
			: proof.error ?? "Live configured source discovery proof failed.",
	}], {
		title: "Platform Live Source Discovery Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
