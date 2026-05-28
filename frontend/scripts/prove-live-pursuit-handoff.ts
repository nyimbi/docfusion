import "./load-env";

import crypto from "node:crypto";
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
	buildLivePursuitHandoff,
	type LivePursuitHandoff,
	type LivePursuitHandoffOpportunity,
} from "@/lib/services/live-pursuit-handoff";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_PURSUIT_HANDOFF_RUN_ID ?? createProofRunId("live_pursuit_handoff");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-pursuit-handoff" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-pursuit-handoff-evidence.md");
const COMPLETION_LOG_ROOT = path.resolve(WORKSPACE_ROOT, ".omx", "logs", "platform-completion");
const PORTFOLIO_PROOF_FILENAME = "live-opportunity-portfolio-triage.json";

interface PortfolioProofJson {
	runId?: string;
	completedAt?: string;
	triage?: {
		generatedAt: string;
		ranked: Array<{
			runId: string;
			sourceKind: string;
			portfolioRecommendation: LivePursuitHandoffOpportunity["portfolioRecommendation"];
			portfolioScore: number;
			rankingReasons: string[];
			opportunity: {
				title: string;
				organization?: string;
				portalUrl?: string;
				documentUrl?: string;
			};
			response: {
				totalDraftWordCount: number;
				submissionSchedule?: LivePursuitHandoffOpportunity["submissionSchedule"];
				readiness: {
					status: string;
				};
				pursuitFit: {
					pursuitRoute: LivePursuitHandoffOpportunity["pursuitRoute"];
				};
			};
			qualificationWorkflow?: LivePursuitHandoffOpportunity["qualificationWorkflow"];
		}>;
	};
	error?: string;
}

interface ResponseProofJson {
	runId?: string;
	responseReadiness?: {
		draftArtifactPaths?: string[];
		qualificationPackage?: {
			artifactPaths?: string[];
		};
	};
}

interface LivePursuitHandoffProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	sourcePortfolio?: {
		runId?: string;
		path: string;
		completedAt?: string;
		rankedCount: number;
	};
	handoff?: {
		primaryRunId: string;
		primaryTitle: string;
		primaryDeadline?: string;
		primaryDeadlineUrgency?: string;
		reviewQueueCount: number;
		artifactCount: number;
		briefHash: string;
		artifactPaths: string[];
	};
	error?: string;
}

async function main() {
	const proof: LivePursuitHandoffProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
	};
	let disposition: EvidenceRecord["disposition"] = "fail";

	try {
		Object.assign(proof, await proveLivePursuitHandoff());
		proof.completedAt = new Date().toISOString();
		disposition = "pass";
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		disposition = "fail";
	} finally {
		await writeArtifacts(proof, disposition);
	}

	console.log(JSON.stringify(proof, null, 2));
	if (disposition !== "pass") process.exit(1);
}

async function proveLivePursuitHandoff(): Promise<Partial<LivePursuitHandoffProof>> {
	const sourcePortfolio = await readLatestPortfolioProof();
	if (!sourcePortfolio.proof.triage?.ranked.length) {
		throw new Error("Latest live portfolio triage proof has no ranked opportunities");
	}
	const responseProofs = await responseProofsByRunId();
	const primary = sourcePortfolio.proof.triage.ranked.find((candidate) =>
		candidate.portfolioRecommendation === "pursue_now"
	);
	if (!primary) throw new Error("Latest live portfolio triage proof has no pursue-now candidate");

	const reviewQueue = sourcePortfolio.proof.triage.ranked
		.filter((candidate) => candidate.portfolioRecommendation === "review_before_pursuit")
		.slice(0, 3);
	const handoff = buildLivePursuitHandoff({
		portfolioRunId: sourcePortfolio.proof.runId ?? "unknown",
		primaryPursuit: handoffOpportunity(primary, responseProofs),
		reviewQueue: reviewQueue.map((candidate) => handoffOpportunity(candidate, responseProofs)),
	});
	const handoffArtifactPaths = await writeHandoffArtifacts(handoff);
	return {
		sourcePortfolio: {
			runId: sourcePortfolio.proof.runId,
			path: sourcePortfolio.relativePath,
			completedAt: sourcePortfolio.proof.completedAt,
			rankedCount: sourcePortfolio.proof.triage.ranked.length,
		},
		handoff: {
			primaryRunId: handoff.primaryPursuit.runId,
			primaryTitle: handoff.primaryPursuit.title,
			primaryDeadline: handoff.primaryPursuit.submissionSchedule?.deadlineLabel,
			primaryDeadlineUrgency: handoff.primaryPursuit.submissionSchedule?.urgency,
			reviewQueueCount: handoff.reviewQueue.length,
			artifactCount: handoff.artifactCount,
			briefHash: crypto.createHash("sha256").update(handoff.operatorBriefMarkdown).digest("hex"),
			artifactPaths: handoffArtifactPaths,
		},
	};
}

function handoffOpportunity(
	candidate: NonNullable<PortfolioProofJson["triage"]>["ranked"][number],
	responseProofs: Map<string, ResponseProofJson>
): LivePursuitHandoffOpportunity {
	const responseProof = responseProofs.get(candidate.runId);
	return {
		runId: candidate.runId,
		sourceKind: candidate.sourceKind,
		title: candidate.opportunity.title,
		organization: candidate.opportunity.organization,
		portalUrl: candidate.opportunity.portalUrl,
		documentUrl: candidate.opportunity.documentUrl,
		portfolioRecommendation: candidate.portfolioRecommendation,
		pursuitRoute: candidate.response.pursuitFit.pursuitRoute,
		portfolioScore: candidate.portfolioScore,
		readinessStatus: candidate.response.readiness.status,
		responseDraftWordCount: candidate.response.totalDraftWordCount,
		submissionSchedule: candidate.response.submissionSchedule,
		responseArtifactPaths: responseProof?.responseReadiness?.draftArtifactPaths ?? [],
		qualificationArtifactPaths: responseProof?.responseReadiness?.qualificationPackage?.artifactPaths,
		qualificationWorkflow: candidate.qualificationWorkflow,
		rankingReasons: candidate.rankingReasons,
	};
}

async function readLatestPortfolioProof(): Promise<{ relativePath: string; proof: PortfolioProofJson }> {
	const files = await findFilesNamed(COMPLETION_LOG_ROOT, PORTFOLIO_PROOF_FILENAME).catch((error) => {
		if (isMissingPathError(error)) return [];
		throw error;
	});
	const proofs: Array<{ relativePath: string; proof: PortfolioProofJson; completedAt: string }> = [];
	for (const filePath of files) {
		const raw = await fs.readFile(filePath, "utf8");
		const proof = JSON.parse(raw) as PortfolioProofJson;
		if (!proof.error && proof.completedAt && proof.triage?.ranked.length) {
			proofs.push({
				relativePath: path.relative(WORKSPACE_ROOT, filePath),
				proof,
				completedAt: proof.completedAt,
			});
		}
	}
	proofs.sort((left, right) => compareIso(right.completedAt, left.completedAt));
	const latest = proofs[0];
	if (!latest) throw new Error("No completed live portfolio triage proof artifacts were found");
	return latest;
}

async function responseProofsByRunId(): Promise<Map<string, ResponseProofJson>> {
	const files = await findFilesNamed(COMPLETION_LOG_ROOT, "live-opportunity-response-readiness.json").catch((error) => {
		if (isMissingPathError(error)) return [];
		throw error;
	});
	const proofs = new Map<string, ResponseProofJson>();
	for (const filePath of files) {
		const raw = await fs.readFile(filePath, "utf8");
		const proof = JSON.parse(raw) as ResponseProofJson;
		if (proof.runId) proofs.set(proof.runId, proof);
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

async function writeHandoffArtifacts(handoff: LivePursuitHandoff): Promise<string[]> {
	const relativePaths: string[] = [];
	const jsonPath = await writeProofJson(LOG_DIR, "live-pursuit-handoff.json", handoff);
	const jsonReadback = await fs.readFile(jsonPath, "utf8");
	if (jsonReadback.trim().length === 0) throw new Error("Live pursuit handoff JSON readback was empty");
	relativePaths.push(path.relative(WORKSPACE_ROOT, jsonPath));

	const briefPath = path.resolve(LOG_DIR, "live-pursuit-handoff.md");
	await fs.writeFile(briefPath, handoff.operatorBriefMarkdown, "utf8");
	const briefReadback = await fs.readFile(briefPath, "utf8");
	if (crypto.createHash("sha256").update(briefReadback).digest("hex")
		!== crypto.createHash("sha256").update(handoff.operatorBriefMarkdown).digest("hex")) {
		throw new Error("Live pursuit handoff brief readback hash mismatch");
	}
	relativePaths.push(path.relative(WORKSPACE_ROOT, briefPath));
	return relativePaths;
}

async function writeArtifacts(
	proof: LivePursuitHandoffProof,
	disposition: EvidenceRecord["disposition"]
) {
	const rawPath = await writeProofJson(LOG_DIR, "live-pursuit-handoff-proof.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001/F-005/F-008/F-020",
		journey: "J1/O1/O4",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source-portfolio:${proof.sourcePortfolio?.path ?? "not-found"}`,
			`source-portfolio-run:${proof.sourcePortfolio?.runId ?? "unknown"}`,
			`ranked:${proof.sourcePortfolio?.rankedCount ?? 0}`,
			`primary-run:${proof.handoff?.primaryRunId ?? "none"}`,
			`primary-title:${proof.handoff?.primaryTitle ?? "none"}`,
			`primary-deadline:${proof.handoff?.primaryDeadline ?? "not-found"}`,
			`primary-deadline-urgency:${proof.handoff?.primaryDeadlineUrgency ?? "unknown"}`,
			`review-queue:${proof.handoff?.reviewQueueCount ?? 0}`,
			`handoff-artifacts:${proof.handoff?.artifactCount ?? 0}`,
			...(proof.handoff?.artifactPaths.map((artifactPath) => `handoff-artifact:${artifactPath}`) ?? []),
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe pursuit handoff",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live portfolio and response artifacts were bundled into an operator pursuit handoff."
			: proof.error ?? "Live pursuit handoff proof failed.",
	}], {
		title: "Platform Live Pursuit Handoff Evidence",
	});
}

function compareIso(left: string | undefined, right: string | undefined): number {
	const leftTime = left ? Date.parse(left) : 0;
	const rightTime = right ? Date.parse(right) : 0;
	return (Number.isNaN(leftTime) ? 0 : leftTime) - (Number.isNaN(rightTime) ? 0 : rightTime);
}

function isMissingPathError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
