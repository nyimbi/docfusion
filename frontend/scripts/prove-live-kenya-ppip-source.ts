import "./load-env";

import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { fetchKenyaPpipOpportunities } from "@/lib/services/kenya-ppip-client";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_KENYA_PPIP_PROOF_RUN_ID ?? createProofRunId("live_kenya_ppip");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-kenya-ppip" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-kenya-ppip-evidence.md");
const SOURCE_URL = process.env.LIVE_KENYA_PPIP_URL ?? "https://tenders.go.ke/tenders";

interface LiveKenyaPpipProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	source: {
		url: string;
		apiUrl?: string;
		total?: number;
		opportunityCount: number;
		sampleOpportunities: Array<{
			title: string;
			sourceId?: string;
			noticeId?: string;
			organization?: string;
			deadline?: string;
			documentUrl?: string;
			portalUrl?: string;
		}>;
	};
	error?: string;
}

async function main() {
	const proof: LiveKenyaPpipProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		source: {
			url: SOURCE_URL,
			opportunityCount: 0,
			sampleOpportunities: [],
		},
	};

	try {
		proof.source = await proveKenyaPpipSource();
		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function proveKenyaPpipSource(): Promise<LiveKenyaPpipProof["source"]> {
	const result = await fetchKenyaPpipOpportunities(SOURCE_URL, {
		limit: 10,
		timeoutMs: 20000,
	});
	if (result.opportunities.length === 0) {
		throw new Error("Kenya PPIP API returned no mapped opportunities");
	}
	const missingDocument = result.opportunities.find((opportunity) => !opportunity.documentUrl);
	if (missingDocument) {
		throw new Error(`Kenya PPIP opportunity is missing document URL: ${missingDocument.title}`);
	}

	return {
		url: SOURCE_URL,
		apiUrl: result.apiUrl,
		total: result.total,
		opportunityCount: result.opportunities.length,
		sampleOpportunities: result.opportunities.slice(0, 5).map((opportunity) => ({
			title: opportunity.title,
			sourceId: opportunity.sourceId,
			noticeId: opportunity.noticeId,
			organization: opportunity.organization,
			deadline: opportunity.deadline instanceof Date
				? opportunity.deadline.toISOString()
				: opportunity.deadline ?? undefined,
			documentUrl: opportunity.documentUrl,
			portalUrl: opportunity.portalUrl,
		})),
	};
}

async function writeArtifacts(proof: LiveKenyaPpipProof, disposition: EvidenceRecord["disposition"]) {
	const rawPath = await writeProofJson(LOG_DIR, "live-kenya-ppip-source.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001",
		journey: "J1/O1",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source:${proof.source.url}`,
			`api:${proof.source.apiUrl ?? "unknown"}`,
			`opportunities:${proof.source.opportunityCount}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe Kenya PPIP source discovery",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live Kenya PPIP API returned mapped opportunity candidates with source document URLs."
			: proof.error ?? "Live Kenya PPIP source discovery proof failed.",
	}], {
		title: "Platform Live Kenya PPIP Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
