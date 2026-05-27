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
import { unicefParser } from "@/lib/scrapers/parsers/unicef";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_SOURCE_DISCOVERY_PROOF_RUN_ID
	?? process.env.LIVE_UNICEF_SOURCE_PROOF_RUN_ID
	?? createProofRunId("live_unicef_source");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-source-discovery" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-source-discovery-evidence.md");
const SOURCE_URL = process.env.LIVE_SOURCE_DISCOVERY_URL ?? "https://www.unicef.org/supply/service-contracts-tender-calendar";

interface LiveUnicefSourceProof {
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
			opportunityType?: string;
			portalUrl?: string;
		}>;
	};
	ictProbe?: {
		title: string;
		noticeId?: string;
		category?: string;
		estimatedDuration?: unknown;
		estimatedIssuance?: unknown;
		contactEmail?: unknown;
	};
	error?: string;
}

async function main() {
	const proof: LiveUnicefSourceProof = {
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
			throw new Error(sourceResult.error ?? "Firecrawl returned no UNICEF source content");
		}

		const parsed = await unicefParser.parse({ markdown, links, url: SOURCE_URL });
		if (parsed.opportunities.length === 0) {
			throw new Error("UNICEF parser returned no source opportunities");
		}
		if (parsed.opportunities.some((opportunity) => opportunity.deadline)) {
			throw new Error("UNICEF parser fabricated a deadline from calendar issuance windows");
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
				opportunityType: opportunity.opportunityType ?? undefined,
				portalUrl: opportunity.portalUrl ?? undefined,
			})),
		};

		const ictOpportunity = parsed.opportunities.find((opportunity) =>
			/\b(ict|telephony|software|satellite|mobile|hardware)\b/i.test(opportunity.title)
		);
		if (!ictOpportunity) {
			throw new Error("UNICEF source did not expose an ICT-relevant service contract calendar row");
		}
		const unicefMetadata = (ictOpportunity.metadata?.unicef ?? {}) as Record<string, unknown>;
		proof.ictProbe = {
			title: ictOpportunity.title,
			noticeId: ictOpportunity.noticeId ?? undefined,
			category: ictOpportunity.category,
			estimatedDuration: unicefMetadata.estimatedDuration,
			estimatedIssuance: unicefMetadata.estimatedIssuance,
			contactEmail: unicefMetadata.contactEmail,
		};
		if (!proof.ictProbe.estimatedIssuance || !proof.ictProbe.contactEmail) {
			throw new Error("UNICEF ICT row did not preserve issuance metadata and contact channel");
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

async function writeArtifacts(proof: LiveUnicefSourceProof, disposition: EvidenceRecord["disposition"]) {
	const rawPath = await writeProofJson(LOG_DIR, "live-unicef-source.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001",
		journey: "J1/O1",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source:${proof.source.url}`,
			`opportunities:${proof.source.opportunityCount}`,
			...(proof.ictProbe ? [`ict-row:${proof.ictProbe.title}`] : []),
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe UNICEF source discovery",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live UNICEF Supply Division source scrape returned normalized service contract calendar opportunities with ICT issuance metadata."
			: proof.error ?? "Live UNICEF source discovery proof failed.",
	}], {
		title: "Platform Live Source Discovery Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
