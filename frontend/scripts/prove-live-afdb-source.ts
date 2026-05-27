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

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID
	?? process.env.LIVE_AFDB_SOURCE_PROOF_RUN_ID
	?? createProofRunId("live_afdb_source");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-source-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-source-discovery-evidence.md");
const SOURCE_URL = process.env.LIVE_SOURCE_DISCOVERY_URL ?? "https://www.afdb.org/en/projects-and-operations/procurement";
const DETAIL_PROBE_LIMIT = 5;

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
		const client = new FirecrawlClient({ timeout: 60000 });
		const sourceResult = await client.scrape(SOURCE_URL, {
			formats: ["markdown", "links"],
			timeout: 60000,
		});
		const markdown = sourceResult.data?.markdown ?? "";
		const links = sourceResult.data?.links ?? [];
		if (!sourceResult.success || markdown.trim().length === 0) {
			throw new Error(sourceResult.error ?? "Firecrawl returned no AFDB source content");
		}

		const parsed = await afdbParser.parse({ markdown, links, url: SOURCE_URL });
		if (parsed.opportunities.length === 0) {
			throw new Error("AFDB parser returned no source opportunities");
		}
		if (parsed.opportunities.some((opportunity) => /\baward\b/i.test(opportunity.category ?? ""))) {
			throw new Error("AFDB parser returned award rows as active opportunity candidates");
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
				countryRegion: opportunity.countryRegion ?? undefined,
				category: opportunity.category ?? undefined,
				portalUrl: opportunity.portalUrl ?? undefined,
			})),
		};

		for (const opportunity of parsed.opportunities.slice(0, DETAIL_PROBE_LIMIT)) {
			if (!opportunity.portalUrl) continue;
			const detailResult = await client.scrape(opportunity.portalUrl, {
				formats: ["markdown", "links"],
				timeout: 60000,
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
