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

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID ?? createProofRunId("live_source_discovery");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-source-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-source-discovery-evidence.md");
const SOURCE_URL = process.env.LIVE_SOURCE_DISCOVERY_URL ?? "https://procurement-notices.undp.org";

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
	const client = new FirecrawlClient({ timeout: 60000 });
	const result = await client.scrape(SOURCE_URL, {
		formats: ["markdown", "links"],
		timeout: 60000,
	});
	const markdown = result.data?.markdown ?? "";
	const links = result.data?.links ?? [];
	if (!result.success || markdown.trim().length === 0) {
		throw new Error(result.error ?? "Firecrawl returned no configured source content");
	}

	const parser = parserForSourceUrl(SOURCE_URL);
	const parsed = await parser.parse({
		markdown,
		links,
		url: SOURCE_URL,
	});
	if (parsed.opportunities.length === 0) {
		throw new Error("Generic tender parser returned no source opportunities");
	}

	const firstTitle = parsed.opportunities[0]?.title ?? "";
	if (/\b(Title|Ref No|Deadline|Posted)\b/i.test(firstTitle)) {
		throw new Error(`Source opportunity title was not normalized: ${firstTitle}`);
	}

	return {
		url: SOURCE_URL,
		title: result.data?.metadata?.title,
		markdownLength: markdown.trim().length,
		linkCount: links.length,
		opportunityCount: parsed.opportunities.length,
		sampleOpportunities: parsed.opportunities.slice(0, 5).map((opportunity) => ({
			title: opportunity.title,
			noticeId: opportunity.noticeId ?? undefined,
			organization: opportunity.organization ?? undefined,
			countryRegion: opportunity.countryRegion ?? undefined,
			portalUrl: opportunity.portalUrl ?? undefined,
		})),
	};
}

function parserForSourceUrl(sourceUrl: string) {
	const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
	if (host.includes("comesa.int")) return getParser("comesa") ?? genericParser;
	if (host.includes("tenders.go.ke")) return getParser("kenya_ppip") ?? genericParser;
	if (host.includes("ungm.org")) return getParser("ungm") ?? genericParser;
	return genericParser;
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
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe configured source discovery",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live configured source scrape returned parsed and normalized opportunity candidates."
			: proof.error ?? "Live configured source discovery proof failed.",
	}], {
		title: "Platform Live Source Discovery Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
