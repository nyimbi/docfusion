import "./load-env";

import { spawnSync } from "node:child_process";
import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type ProofDisposition,
} from "./platform-proof/core";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.RFP_CYCLE_RUN_ID ?? createProofRunId("rfp_intake_response_cycle");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "rfp-intake-response-cycle" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-rfp-intake-response-cycle-evidence.md");
const APPLY = process.env.RFP_CYCLE_APPLY === "1";
const RECORD_SUBMISSION = process.env.RFP_CYCLE_RECORD_SUBMISSION === "1";
const ORGANIZATION_ID = optionalString(process.env.RFP_CYCLE_ORGANIZATION_ID);
const SCRIPT_ENV_FILE = process.env.RFP_CYCLE_ENV_FILE || "../.env";

type CycleStep = {
	name: string;
	script: string;
	env: Record<string, string | undefined>;
	required?: boolean;
};

type CycleStepResult = {
	name: string;
	script: string;
	status: "passed" | "failed" | "skipped";
	exitCode: number | null;
	durationMs: number;
	stdoutTail: string;
	stderrTail: string;
};

type CycleProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	apply: boolean;
	recordSubmission: boolean;
	organizationId?: string;
	scriptEnvFile: string;
	steps: CycleStepResult[];
	disposition?: ProofDisposition;
};

async function main() {
	const proof: CycleProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		apply: APPLY,
		recordSubmission: RECORD_SUBMISSION,
		organizationId: ORGANIZATION_ID,
		scriptEnvFile: SCRIPT_ENV_FILE,
		steps: [],
	};

	let disposition: ProofDisposition = "pass";
	for (const step of buildSteps()) {
		const result = runStep(step);
		proof.steps.push(result);
		if (result.status === "failed") {
			disposition = step.required === false ? "partial" : "fail";
			if (step.required !== false) break;
		}
	}

	proof.completedAt = new Date().toISOString();
	proof.disposition = disposition;
	await writeProofJson(LOG_DIR, `${RUN_ID}.json`, proof);
	await appendEvidenceRecords(EVIDENCE_PATH, [{
		facility: "rfp-cycle",
		journey: "source intake to response artifact cycle",
		run_id: RUN_ID,
		artifact_ids: proof.steps.map((step) => `${step.name}:${step.status}`),
		topology_tier: "application",
		verification_bucket: APPLY ? "live-rfp-cycle-apply" : "live-rfp-cycle-dry-run",
		timestamp: proof.completedAt,
		operator: "system",
		cleanup_status: "not-applicable",
		disposition,
		notes: summarizeProof(proof),
	}], { title: "RFP Intake Response Cycle Evidence" });

	console.log(JSON.stringify(proof, null, 2));
	if (disposition === "fail") {
		process.exitCode = 1;
	}
}

function buildSteps(): CycleStep[] {
	return [
		{
			name: "source-document-intake",
			script: "scripts/run-source-document-intake.ts",
			required: false,
			env: {
				SOURCE_DOCUMENT_INTAKE_RUN_ID: `${RUN_ID}_source_intake`,
				SOURCE_DOCUMENT_INTAKE_LIMIT: envNumber("RFP_CYCLE_SOURCE_LIMIT", "10"),
				SOURCE_DOCUMENT_INTAKE_DRY_RUN: APPLY ? "0" : "1",
				SOURCE_DOCUMENT_INTAKE_RETRY_FAILED: envFlag("RFP_CYCLE_RETRY_FAILED_SOURCES", "0"),
				SOURCE_DOCUMENT_INTAKE_ORGANIZATION_ID: ORGANIZATION_ID,
				SOURCE_DOCUMENT_INTAKE_PARSE_TIMEOUT_MS: envNumber("RFP_CYCLE_PARSE_TIMEOUT_MS", "180000"),
				SOURCE_DOCUMENT_INTAKE_MAX_PER_HOST: envNumber("RFP_CYCLE_SOURCE_MAX_PER_HOST", "2"),
			},
		},
		{
			name: "stalled-parse-recovery",
			script: "scripts/recover-stalled-rfp-parses.ts",
			env: {
				RFP_PARSE_STALL_RECOVERY_RUN_ID: `${RUN_ID}_stall_recovery`,
				RFP_PARSE_STALL_RECOVERY_DRY_RUN: APPLY ? "0" : "1",
				RFP_PARSE_STALL_RECOVERY_ORGANIZATION_ID: ORGANIZATION_ID,
				RFP_PARSE_STALL_RECOVERY_STALE_AFTER_MINUTES: envNumber("RFP_CYCLE_STALE_AFTER_MINUTES", "30"),
				RFP_PARSE_STALL_RECOVERY_LIMIT: envNumber("RFP_CYCLE_STALL_RECOVERY_LIMIT", "25"),
			},
		},
		{
			name: "response-package-backfill",
			script: "scripts/run-response-package-backfill.ts",
			env: {
				LIVE_RESPONSE_BACKFILL_RUN_ID: `${RUN_ID}_response_packages`,
				LIVE_RESPONSE_BACKFILL_LIMIT: envNumber("RFP_CYCLE_RESPONSE_LIMIT", "5"),
				LIVE_RESPONSE_BACKFILL_DRY_RUN: APPLY ? "0" : "1",
				LIVE_RESPONSE_BACKFILL_MIN_FIT_SCORE: envNumber("RFP_CYCLE_MIN_FIT_SCORE", "50"),
			},
		},
		{
			name: "requirement-acceptance",
			script: "scripts/run-requirement-acceptance-backfill.ts",
			env: {
				LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_RUN_ID: `${RUN_ID}_requirement_acceptance`,
				LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_LIMIT: envNumber("RFP_CYCLE_ACCEPTANCE_LIMIT", "80"),
				LIVE_REQUIREMENT_ACCEPTANCE_BACKFILL_APPLY: APPLY ? "1" : "0",
			},
		},
		{
			name: "response-readiness",
			script: "scripts/run-response-readiness-pass.ts",
			env: {
				LIVE_RESPONSE_READINESS_PASS_RUN_ID: `${RUN_ID}_response_readiness`,
				LIVE_RESPONSE_READINESS_PASS_LIMIT: envNumber("RFP_CYCLE_READINESS_LIMIT", "10"),
				LIVE_RESPONSE_READINESS_PASS_APPLY: APPLY ? "1" : "0",
			},
		},
		{
			name: "final-artifact-publish",
			script: "scripts/run-final-artifact-publish.ts",
			env: {
				LIVE_FINAL_ARTIFACT_PUBLISH_RUN_ID: `${RUN_ID}_final_artifact`,
				LIVE_FINAL_ARTIFACT_PUBLISH_LIMIT: envNumber("RFP_CYCLE_FINAL_ARTIFACT_LIMIT", "5"),
				LIVE_FINAL_ARTIFACT_PUBLISH_APPLY: APPLY ? "1" : "0",
			},
		},
		{
			name: "final-submission-record",
			script: "scripts/run-final-submission-record.ts",
			env: {
				LIVE_FINAL_SUBMISSION_RECORD_RUN_ID: `${RUN_ID}_final_submission`,
				LIVE_FINAL_SUBMISSION_RECORD_LIMIT: envNumber("RFP_CYCLE_FINAL_SUBMISSION_LIMIT", "5"),
				LIVE_FINAL_SUBMISSION_RECORD_APPLY: RECORD_SUBMISSION ? "1" : "0",
				LIVE_FINAL_SUBMISSION_RECORD_CONFIRMATION_NUMBER: process.env.RFP_CYCLE_SUBMISSION_CONFIRMATION_NUMBER,
				LIVE_FINAL_SUBMISSION_RECORD_METHOD: process.env.RFP_CYCLE_SUBMISSION_METHOD,
				LIVE_FINAL_SUBMISSION_RECORD_NOTES: process.env.RFP_CYCLE_SUBMISSION_NOTES,
			},
		},
	];
}

function runStep(step: CycleStep): CycleStepResult {
	const startedAt = Date.now();
	const result = spawnSync("npx", ["tsx", step.script], {
		cwd: process.cwd(),
		env: {
			...process.env,
			DOCFUSION_SCRIPT_ENV_FILE: SCRIPT_ENV_FILE,
			...stripUndefined(step.env),
		},
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	});
	const exitCode = result.status ?? null;
	return {
		name: step.name,
		script: step.script,
		status: exitCode === 0 ? "passed" : "failed",
		exitCode,
		durationMs: Date.now() - startedAt,
		stdoutTail: tail(result.stdout ?? ""),
		stderrTail: tail(result.stderr ?? ""),
	};
}

function summarizeProof(proof: CycleProof): string {
	const passed = proof.steps.filter((step) => step.status === "passed").length;
	const failed = proof.steps.filter((step) => step.status === "failed").length;
	const skipped = proof.steps.filter((step) => step.status === "skipped").length;
	return `${proof.apply ? "Apply" : "Dry-run"} cycle completed with ${passed} passed, ${failed} failed, ${skipped} skipped step(s).`;
}

function tail(value: string, maxChars = 4000): string {
	return value.length <= maxChars ? value : value.slice(value.length - maxChars);
}

function stripUndefined(value: Record<string, string | undefined>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => entry[1] !== undefined)
	);
}

function optionalString(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed || undefined;
}

function envNumber(key: string, defaultValue: string): string {
	const raw = process.env[key];
	return raw && /^\d+$/.test(raw) ? raw : defaultValue;
}

function envFlag(key: string, defaultValue: "0" | "1"): "0" | "1" {
	return process.env[key] === "1" ? "1" : defaultValue;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
