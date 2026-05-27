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
import { parseUndpNoticeDetailMarkdown, undpParser } from "@/lib/scrapers/parsers/undp";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID
	?? process.env.LIVE_UNDP_SOURCE_PROOF_RUN_ID
	?? createProofRunId("live_undp_source");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-source-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-source-discovery-evidence.md");
const SOURCE_URL = process.env.LIVE_SOURCE_DISCOVERY_URL ?? "https://procurement-notices.undp.org";

interface LiveUndpSourceProof {
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

async function main() {
	const proof: LiveUndpSourceProof = {
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
		const client = new FirecrawlClient({ timeout: 60000 });
		const sourceResult = await client.scrape(SOURCE_URL, {
			formats: ["markdown", "links"],
			timeout: 60000,
		});
		const markdown = sourceResult.data?.markdown ?? "";
		const links = sourceResult.data?.links ?? [];
		if (!sourceResult.success || markdown.trim().length === 0) {
			throw new Error(sourceResult.error ?? "Firecrawl returned no UNDP source content");
		}

		const parsed = await undpParser.parse({ markdown, links, url: SOURCE_URL });
		if (parsed.opportunities.length === 0) {
			throw new Error("UNDP parser returned no source opportunities");
		}

		const first = parsed.opportunities.find((opportunity) => opportunity.portalUrl);
		if (!first?.portalUrl) {
			throw new Error("UNDP parser returned no opportunity portal URL for detail probing");
		}

		const detailResult = await client.scrape(first.portalUrl, {
			formats: ["markdown", "links"],
			timeout: 60000,
		});
		if (!detailResult.success || !detailResult.data?.markdown) {
			throw new Error(detailResult.error ?? "Firecrawl returned no UNDP detail content");
		}
		const detail = parseUndpNoticeDetailMarkdown(
			detailResult.data.markdown,
			detailResult.data.links ?? []
		);
		if (!detail.primaryLink) {
			throw new Error("UNDP detail page did not expose a primary procurement document link");
		}

		proof.source = {
			url: SOURCE_URL,
			title: sourceResult.data?.metadata?.title,
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
		proof.documentProbe = {
			noticeTitle: first.title,
			noticeId: first.noticeId ?? undefined,
			portalUrl: first.portalUrl,
			documentUrl: detail.primaryLink.url,
			documentLabel: detail.primaryLink.description,
			documentLinkCount: detail.links.length,
		};
		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function writeArtifacts(proof: LiveUndpSourceProof, disposition: EvidenceRecord["disposition"]) {
	const rawPath = await writeProofJson(LOG_DIR, "live-undp-source.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001",
		journey: "J1/O1",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source:${proof.source.url}`,
			`opportunities:${proof.source.opportunityCount}`,
			...(proof.documentProbe ? [`document:${proof.documentProbe.documentUrl}`] : []),
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe UNDP source discovery",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live UNDP source scrape returned normalized opportunities and a procurement document link from a notice detail page."
			: proof.error ?? "Live UNDP source discovery proof failed.",
	}], {
		title: "Platform Live Source Discovery Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
