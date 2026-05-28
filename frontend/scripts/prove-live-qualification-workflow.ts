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
import type { LiveQualificationPackage } from "@/lib/services/live-response-package";
import {
	buildLiveQualificationWorkflow,
	type LiveQualificationWorkflow,
} from "@/lib/services/live-qualification-workflow";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_QUALIFICATION_WORKFLOW_PROOF_RUN_ID
	?? createProofRunId("live_qualification_workflow");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-qualification-workflow" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-qualification-workflow-evidence.md");
const COMPLETION_LOG_ROOT = path.resolve(WORKSPACE_ROOT, ".omx", "logs", "platform-completion");

interface SourceQualificationPackage {
	packagePath: string;
	packageValue: LiveQualificationPackage;
	sourceRunId?: string;
	sourceProofPath?: string;
	opportunityTitle?: string;
	sourceKind?: string;
}

interface LiveQualificationWorkflowProof {
	runId: string;
	startedAt: string;
	completedAt?: string;
	sourcePackage?: {
		path: string;
		sourceRunId?: string;
		sourceProofPath?: string;
		opportunityTitle?: string;
		sourceKind?: string;
		pursuitRoute: LiveQualificationPackage["pursuitRoute"];
		requiredArtifactCount: number;
		checklistCount: number;
	};
	workflow?: {
		status: LiveQualificationWorkflow["status"];
		currentState: LiveQualificationWorkflow["currentState"];
		gateCount: number;
		blockedGateCount: number;
		taskCount: number;
		mandatoryTaskCount: number;
		sourceSignalCount: number;
		briefHash: string;
		artifactPaths: string[];
	};
	error?: string;
}

async function main() {
	const proof: LiveQualificationWorkflowProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
	};
	let disposition: EvidenceRecord["disposition"] = "fail";

	try {
		Object.assign(proof, await proveLiveQualificationWorkflow());
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

async function proveLiveQualificationWorkflow(): Promise<Partial<LiveQualificationWorkflowProof>> {
	const sourcePackage = await findLatestQualificationPackage();
	const workflow = buildLiveQualificationWorkflow(sourcePackage.packageValue);
	if (workflow.status !== "ready_for_operator_execution") {
		throw new Error(`Qualification workflow is blocked: ${workflow.gates.flatMap((gate) => gate.blockers).join("; ")}`);
	}
	if (workflow.gates.length < 5) {
		throw new Error(`Qualification workflow has too few gates: ${workflow.gates.length}`);
	}
	if (workflow.metrics.mandatoryTaskCount < 4) {
		throw new Error(`Qualification workflow has too few mandatory tasks: ${workflow.metrics.mandatoryTaskCount}`);
	}
	if (workflow.metrics.sourceSignalCount === 0) {
		throw new Error("Qualification workflow tasks did not retain source requirement signals");
	}

	const workflowArtifactPaths = await writeWorkflowArtifacts(workflow);
	return {
		sourcePackage: {
			path: sourcePackage.packagePath,
			sourceRunId: sourcePackage.sourceRunId,
			sourceProofPath: sourcePackage.sourceProofPath,
			opportunityTitle: sourcePackage.opportunityTitle,
			sourceKind: sourcePackage.sourceKind,
			pursuitRoute: sourcePackage.packageValue.pursuitRoute,
			requiredArtifactCount: sourcePackage.packageValue.requiredArtifacts.length,
			checklistCount: sourcePackage.packageValue.checklist.length,
		},
		workflow: {
			status: workflow.status,
			currentState: workflow.currentState,
			gateCount: workflow.metrics.gateCount,
			blockedGateCount: workflow.metrics.blockedGateCount,
			taskCount: workflow.metrics.taskCount,
			mandatoryTaskCount: workflow.metrics.mandatoryTaskCount,
			sourceSignalCount: workflow.metrics.sourceSignalCount,
			briefHash: crypto.createHash("sha256").update(workflow.operatorBriefMarkdown).digest("hex"),
			artifactPaths: workflowArtifactPaths,
		},
	};
}

async function findLatestQualificationPackage(): Promise<SourceQualificationPackage> {
	const entries = await fs.readdir(COMPLETION_LOG_ROOT, { withFileTypes: true }).catch(() => []);
	const candidates: Array<SourceQualificationPackage & { modifiedAt: number }> = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || !entry.name.startsWith("live-response-readiness-")) continue;
		const runDir = path.resolve(COMPLETION_LOG_ROOT, entry.name);
		const packagePath = path.resolve(runDir, "qualification-package", "qualification-package.json");
		const rawPackage = await fs.readFile(packagePath, "utf8").catch(() => undefined);
		if (!rawPackage) continue;
		const packageValue = parseQualificationPackage(rawPackage, packagePath);
		const sourceProofPath = path.resolve(runDir, "live-opportunity-response-readiness.json");
		const sourceProof = await readSourceProof(sourceProofPath);
		const stat = await fs.stat(packagePath);
		candidates.push({
			packagePath: path.relative(WORKSPACE_ROOT, packagePath),
			packageValue,
			sourceRunId: sourceProof?.runId,
			sourceProofPath: sourceProof ? path.relative(WORKSPACE_ROOT, sourceProofPath) : undefined,
			opportunityTitle: sourceProof?.opportunity?.title,
			sourceKind: sourceProof?.source?.kind,
			modifiedAt: stat.mtimeMs,
		});
	}
	candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
	const latest = candidates[0];
	if (!latest) {
		throw new Error("No live qualification package artifacts found; run live-kenya-ppip-response-readiness first");
	}
	return latest;
}

function parseQualificationPackage(raw: string, packagePath: string): LiveQualificationPackage {
	const value = JSON.parse(raw) as unknown;
	if (!isQualificationPackage(value)) {
		throw new Error(`Invalid qualification package artifact: ${packagePath}`);
	}
	return value;
}

function isQualificationPackage(value: unknown): value is LiveQualificationPackage {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (record.pursuitRoute === "supplier_registration" || record.pursuitRoute === "prequalification")
		&& typeof record.title === "string"
		&& typeof record.summary === "string"
		&& Array.isArray(record.requiredArtifacts)
		&& record.requiredArtifacts.every((artifact) => typeof artifact === "string")
		&& Array.isArray(record.checklist)
		&& record.checklist.every((item) => {
			if (!item || typeof item !== "object") return false;
			const checklistItem = item as Record<string, unknown>;
			return typeof checklistItem.id === "string"
				&& (checklistItem.priority === "mandatory" || checklistItem.priority === "review")
				&& typeof checklistItem.text === "string"
				&& (checklistItem.ownerHint === "proposal_manager"
					|| checklistItem.ownerHint === "compliance"
					|| checklistItem.ownerHint === "technical_lead")
				&& Array.isArray(checklistItem.sourceRequirementIds);
		})
		&& typeof record.operatorBriefMarkdown === "string";
}

async function readSourceProof(sourceProofPath: string): Promise<{
	runId?: string;
	source?: { kind?: string };
	opportunity?: { title?: string };
} | undefined> {
	const raw = await fs.readFile(sourceProofPath, "utf8").catch(() => undefined);
	if (!raw) return undefined;
	const parsed = JSON.parse(raw) as {
		runId?: string;
		source?: { kind?: string };
		opportunity?: { title?: string };
	};
	return parsed;
}

async function writeWorkflowArtifacts(workflow: LiveQualificationWorkflow): Promise<string[]> {
	const relativePaths: string[] = [];
	const workflowJsonPath = await writeProofJson(LOG_DIR, "live-qualification-workflow.json", workflow);
	const jsonReadback = await fs.readFile(workflowJsonPath, "utf8");
	if (jsonReadback.trim().length === 0) {
		throw new Error("Live qualification workflow JSON readback was empty");
	}
	relativePaths.push(path.relative(WORKSPACE_ROOT, workflowJsonPath));

	const briefPath = path.resolve(LOG_DIR, "live-qualification-workflow.md");
	await fs.writeFile(briefPath, workflow.operatorBriefMarkdown, "utf8");
	const briefReadback = await fs.readFile(briefPath, "utf8");
	if (crypto.createHash("sha256").update(briefReadback).digest("hex")
		!== crypto.createHash("sha256").update(workflow.operatorBriefMarkdown).digest("hex")) {
		throw new Error("Live qualification workflow brief readback hash mismatch");
	}
	relativePaths.push(path.relative(WORKSPACE_ROOT, briefPath));
	return relativePaths;
}

async function writeArtifacts(
	proof: LiveQualificationWorkflowProof,
	disposition: EvidenceRecord["disposition"]
) {
	const rawPath = await writeProofJson(LOG_DIR, "live-qualification-workflow-proof.json", proof);
	const relativeRawPath = path.relative(WORKSPACE_ROOT, rawPath);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "F-001/F-005/F-020",
		journey: "J1/O1/O4",
		run_id: RUN_ID,
		artifact_ids: [
			`log:${relativeRawPath}`,
			`source-package:${proof.sourcePackage?.path ?? "not-found"}`,
			`source-run:${proof.sourcePackage?.sourceRunId ?? "unknown"}`,
			`source-kind:${proof.sourcePackage?.sourceKind ?? "unknown"}`,
			`pursuit-route:${proof.sourcePackage?.pursuitRoute ?? "not-run"}`,
			`required-artifacts:${proof.sourcePackage?.requiredArtifactCount ?? 0}`,
			`checklist:${proof.sourcePackage?.checklistCount ?? 0}`,
			`workflow-status:${proof.workflow?.status ?? "not-run"}`,
			`workflow-state:${proof.workflow?.currentState ?? "not-run"}`,
			`workflow-gates:${proof.workflow?.gateCount ?? 0}`,
			`workflow-blocked-gates:${proof.workflow?.blockedGateCount ?? 0}`,
			`workflow-tasks:${proof.workflow?.taskCount ?? 0}`,
			`workflow-mandatory-tasks:${proof.workflow?.mandatoryTaskCount ?? 0}`,
			`workflow-source-signals:${proof.workflow?.sourceSignalCount ?? 0}`,
			...(proof.workflow?.artifactPaths.map((artifactPath) => `workflow-artifact:${artifactPath}`) ?? []),
		],
		topology_tier: "live-connectivity",
		verification_bucket: "live-safe qualification workflow",
		timestamp: new Date().toISOString(),
		operator: "Codex",
		cleanup_status: "not-applicable",
		disposition,
		notes: disposition === "pass"
			? "Live qualification package artifact was converted into an operator-executable qualification workflow."
			: proof.error ?? "Live qualification workflow proof failed.",
	}], {
		title: "Platform Live Qualification Workflow Evidence",
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
