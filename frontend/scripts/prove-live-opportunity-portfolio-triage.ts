import "./load-env";

import fs from "node:fs/promises";
import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import {
	formatLiveResponsePortfolioBrief,
	triageLiveResponsePortfolio,
	type LiveResponsePortfolioCandidate,
	type LiveResponsePortfolioTriage,
} from "@/lib/services/live-response-portfolio-triage";
import type { LiveResponsePursuitFitAssessment } from "@/lib/services/live-response-package";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_OPPORTUNITY_PORTFOLIO_TRIAGE_RUN_ID
	?? createProofRunId("live_opportunity_portfolio_triage");
const LOG_DIR = createProofLogDir({
	workspaceRoot: WORKSPACE_ROOT,
	runId: RUN_ID,
	wave: "live-opportunity-portfolio-triage",
});
const EVIDENCE_PATH = path.resolve(
	WORKSPACE_ROOT,
	".omx",
	"state",
	"platform-live-opportunity-portfolio-triage-evidence.md",
);
const RESPONSE_PROOF_FILENAME = "live-opportunity-response-readiness.json";

interface LiveOpportunityPortfolioTriageProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	sourceArtifactCount: number;
	candidateCount: number;
	triage?: LiveResponsePortfolioTriage;
	operatorBriefPath?: string;
	sourceArtifacts: Array<{
		runId: string;
		sourceKind: string;
		opportunityTitle: string;
		path: string;
	}>;
	error?: string;
}

interface LiveResponseReadinessProofJson {
	runId?: string;
	completedAt?: string;
	source?: {
		kind?: string;
		url?: string;
	};
	opportunity?: {
		title?: string;
		organization?: string;
		sourceId?: string;
		portalUrl?: string;
		documentUrl?: string;
	};
	document?: {
		extractionMethod?: string;
		byteLength?: number;
		extractedTextLength?: number;
		doclingStatus?: string;
	};
	responseReadiness?: {
		sourceRequirementCount?: number;
		winThemeSeedCount?: number;
		totalDraftWordCount?: number;
		relevantSnippetCount?: number;
		readiness?: LiveResponsePortfolioCandidate["response"]["readiness"];
		pursuitFit?: LiveResponsePortfolioCandidate["response"]["pursuitFit"];
	};
	error?: string;
}

async function main() {
	const proof: LiveOpportunityPortfolioTriageProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		sourceArtifactCount: 0,
		candidateCount: 0,
		sourceArtifacts: [],
	};

	try {
		const responseProofs = await readLiveResponseProofs();
		const candidates = responseProofs
			.map(({ proof: responseProof }) => responseProofToCandidate(responseProof))
			.filter((candidate): candidate is LiveResponsePortfolioCandidate => Boolean(candidate));
		const triage = triageLiveResponsePortfolio(candidates);
		validateTriage(candidates, triage);

		Object.assign(proof, {
			completedAt: new Date().toISOString(),
			sourceArtifactCount: responseProofs.length,
			candidateCount: candidates.length,
			triage,
			sourceArtifacts: candidates.map((candidate) => ({
				runId: candidate.runId,
				sourceKind: candidate.sourceKind,
				opportunityTitle: candidate.opportunity.title,
				path: responseProofs.find(({ proof: responseProof }) => responseProof.runId === candidate.runId)?.relativePath ?? "",
			})),
		});
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	}
}

async function readLiveResponseProofs(): Promise<Array<{
	relativePath: string;
	proof: LiveResponseReadinessProofJson;
}>> {
	const logsRoot = path.resolve(WORKSPACE_ROOT, ".omx", "logs", "platform-completion");
	const files = await findFilesNamed(logsRoot, RESPONSE_PROOF_FILENAME).catch((error) => {
		if (isMissingPathError(error)) return [];
		throw error;
	});
	const proofs: Array<{ relativePath: string; proof: LiveResponseReadinessProofJson }> = [];
	for (const filePath of files) {
		const raw = await fs.readFile(filePath, "utf8");
		const parsed = JSON.parse(raw) as LiveResponseReadinessProofJson;
		proofs.push({
			relativePath: path.relative(WORKSPACE_ROOT, filePath),
			proof: parsed,
		});
	}
	return proofs;
}

async function findFilesNamed(root: string, filename: string): Promise<string[]> {
	const entries = await fs.readdir(root, { withFileTypes: true });
	const matches: string[] = [];
	for (const entry of entries) {
		const entryPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			matches.push(...await findFilesNamed(entryPath, filename));
		} else if (entry.isFile() && entry.name === filename) {
			matches.push(entryPath);
		}
	}
	return matches;
}

function responseProofToCandidate(proof: LiveResponseReadinessProofJson): LiveResponsePortfolioCandidate | undefined {
	if (proof.error || !proof.completedAt || !proof.responseReadiness?.readiness || !proof.responseReadiness.pursuitFit) {
		return undefined;
	}
	if (!proof.source?.kind || !proof.source.url || !proof.opportunity?.title) {
		return undefined;
	}

	return {
		runId: proof.runId ?? `${proof.source.kind}:${proof.opportunity.title}`,
		sourceKind: proof.source.kind,
		sourceUrl: proof.source.url,
		completedAt: proof.completedAt,
		opportunity: {
			title: proof.opportunity.title,
			organization: proof.opportunity.organization,
			sourceId: proof.opportunity.sourceId,
			portalUrl: proof.opportunity.portalUrl,
			documentUrl: proof.opportunity.documentUrl,
		},
		document: {
			extractionMethod: proof.document?.extractionMethod,
			byteLength: proof.document?.byteLength,
			extractedTextLength: proof.document?.extractedTextLength,
			doclingStatus: proof.document?.doclingStatus,
		},
		response: {
			sourceRequirementCount: proof.responseReadiness.sourceRequirementCount ?? 0,
			evaluatorCriteriaCount: proof.responseReadiness.readiness.evaluationCriteriaIds.length,
			winThemeSeedCount: proof.responseReadiness.winThemeSeedCount ?? 0,
			totalDraftWordCount: proof.responseReadiness.totalDraftWordCount ?? 0,
			relevantSnippetCount: proof.responseReadiness.relevantSnippetCount ?? 0,
			readiness: proof.responseReadiness.readiness,
			pursuitFit: normalizePursuitFit(proof.responseReadiness.pursuitFit),
		},
	};
}

function normalizePursuitFit(
	pursuitFit: LiveResponsePortfolioCandidate["response"]["pursuitFit"]
): LiveResponsePursuitFitAssessment {
	return {
		...pursuitFit,
		pursuitRoute: pursuitFit.pursuitRoute ?? "proposal_response",
	};
}

function validateTriage(
	candidates: LiveResponsePortfolioCandidate[],
	triage: LiveResponsePortfolioTriage,
): void {
	if (candidates.length === 0) {
		throw new Error("No completed live response-readiness proof artifacts with response package evidence were found");
	}
	if (triage.ranked.length === 0) {
		throw new Error("Live response portfolio triage produced no ranked opportunities");
	}
	if (candidates.length >= 2 && triage.ranked.length < 2) {
		throw new Error(`Expected at least two ranked live opportunities, got ${triage.ranked.length}`);
	}
	if (triage.pursueNowCount === 0) {
		throw new Error("Live response portfolio triage found no pursue-now candidate");
	}
	const [top] = triage.ranked;
	if (!top || top.portfolioRecommendation !== "pursue_now") {
		throw new Error(`Top live response opportunity is not pursue-now: ${top?.portfolioRecommendation ?? "none"}`);
	}
}

async function writeArtifacts(
	proof: LiveOpportunityPortfolioTriageProof,
	disposition: EvidenceRecord["disposition"],
): Promise<void> {
	if (proof.triage) {
		const briefPath = path.resolve(LOG_DIR, "live-opportunity-portfolio-triage.md");
		await fs.mkdir(path.dirname(briefPath), { recursive: true });
		await fs.writeFile(briefPath, formatLiveResponsePortfolioBrief(proof.triage), "utf8");
		proof.operatorBriefPath = path.relative(WORKSPACE_ROOT, briefPath);
	}
	const rawPath = await writeProofJson(LOG_DIR, "live-opportunity-portfolio-triage.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	const top = proof.triage?.ranked[0];
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001/F-005/F-008/F-020",
		journey: "J1/O1/O4",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`brief:${proof.operatorBriefPath ?? "not-written"}`,
			`source-artifacts:${proof.sourceArtifactCount}`,
			`ranked:${proof.triage?.ranked.length ?? 0}`,
			`pursue-now:${proof.triage?.pursueNowCount ?? 0}`,
			`review-before-pursuit:${proof.triage?.reviewBeforePursuitCount ?? 0}`,
			`hold-or-partner:${proof.triage?.holdOrPartnerCount ?? 0}`,
			`top-run:${top?.runId ?? "none"}`,
			`top-source:${top?.sourceKind ?? "none"}`,
			`top-fit:${top?.response.pursuitFit.status ?? "none"}:${top?.response.pursuitFit.score ?? 0}`,
			`top-route:${top?.response.pursuitFit.pursuitRoute ?? "none"}`,
			`top-readiness:${top?.response.readiness.status ?? "none"}`,
			`top-score:${top?.portfolioScore ?? 0}`,
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe opportunity portfolio triage",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live response-readiness proof artifacts were ranked into a pursue-now portfolio priority order."
			: proof.error ?? "Live response portfolio triage proof failed.",
	}], {
		title: "Platform Live Opportunity Portfolio Triage Evidence",
	});
}

function isMissingPathError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
