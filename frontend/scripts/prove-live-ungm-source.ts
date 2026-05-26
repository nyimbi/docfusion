import "./load-env";

import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { fetchPublicHttpUrl } from "@/lib/security/public-url";
import { fetchUngmOpportunities } from "@/lib/services/ungm-client";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_UNGM_PROOF_RUN_ID ?? createProofRunId("live_ungm");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-ungm" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-ungm-evidence.md");
const SOURCE_URL = process.env.LIVE_UNGM_URL ?? "https://www.ungm.org/Public/Notice";

interface LiveUngmProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	source: {
		url: string;
		searchUrl?: string;
		total?: number;
		opportunityCount: number;
		portalFetch?: {
			url: string;
			status: number;
			contentType?: string;
			byteLength: number;
		};
		sampleOpportunities: Array<{
			title: string;
			sourceId?: string;
			noticeId?: string;
			organization?: string;
			countryRegion?: string;
			deadline?: string;
			portalUrl?: string;
		}>;
	};
	error?: string;
}

async function main() {
	const proof: LiveUngmProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		source: {
			url: SOURCE_URL,
			opportunityCount: 0,
			sampleOpportunities: [],
		},
	};

	try {
		proof.source = await proveUngmSource();
		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function proveUngmSource(): Promise<LiveUngmProof["source"]> {
	const result = await fetchUngmOpportunities(SOURCE_URL, {
		limit: 10,
		timeoutMs: 20000,
	});
	if (result.opportunities.length === 0) {
		throw new Error("UNGM notice search returned no mapped opportunities");
	}

	const firstPortalUrl = result.opportunities[0]?.portalUrl;
	if (!firstPortalUrl) {
		throw new Error("UNGM proof could not find a portal URL to fetch");
	}
	const portalResponse = await fetchPublicHttpUrl(firstPortalUrl, {
		headers: {
			Range: "bytes=0-2047",
			"User-Agent": "DocFusion/1.0 live-ungm-proof",
		},
		timeoutMs: 20000,
	}, "UNGM portal proof URL");
	if (!portalResponse.ok) {
		throw new Error(`UNGM portal fetch returned HTTP ${portalResponse.status}`);
	}
	const portalBytes = Buffer.from(await portalResponse.arrayBuffer());

	return {
		url: SOURCE_URL,
		searchUrl: result.searchUrl,
		total: result.total,
		opportunityCount: result.opportunities.length,
		portalFetch: {
			url: firstPortalUrl,
			status: portalResponse.status,
			contentType: portalResponse.headers.get("content-type") ?? undefined,
			byteLength: portalBytes.length,
		},
		sampleOpportunities: result.opportunities.slice(0, 5).map((opportunity) => ({
			title: opportunity.title,
			sourceId: opportunity.sourceId,
			noticeId: opportunity.noticeId,
			organization: opportunity.organization,
			countryRegion: opportunity.countryRegion,
			deadline: opportunity.deadline instanceof Date
				? opportunity.deadline.toISOString()
				: opportunity.deadline ?? undefined,
			portalUrl: opportunity.portalUrl,
		})),
	};
}

async function writeArtifacts(proof: LiveUngmProof, disposition: EvidenceRecord["disposition"]) {
	const rawPath = await writeProofJson(LOG_DIR, "live-ungm-source.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001",
		journey: "J1/O1",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source:${proof.source.url}`,
			`search:${proof.source.searchUrl ?? "unknown"}`,
			`opportunities:${proof.source.opportunityCount}`,
			`portal-fetch:${proof.source.portalFetch?.status ?? "not-run"}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe UNGM source discovery",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live UNGM public notice search returned mapped opportunity candidates and a portal fetch succeeded."
			: proof.error ?? "Live UNGM source discovery proof failed.",
	}], {
		title: "Platform Live UNGM Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
