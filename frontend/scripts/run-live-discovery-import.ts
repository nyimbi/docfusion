import "./load-env";

import fs from "node:fs";
import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { DEFAULT_DISCOVERY_SOURCE_URLS, withDefaultDiscoveryRuntimeOptions } from "@/lib/services/default-discovery-sources";
import type { DiscoveryImportInput, DiscoveryImportResult } from "@/lib/services/opportunity-discovery-import";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.LIVE_DISCOVERY_IMPORT_RUN_ID ?? createProofRunId("live_discovery_import");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "live-discovery-import" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-live-discovery-import-evidence.md");

type LiveDiscoveryImportProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	assigneeUserId: string;
	organizationId: string;
	input: DiscoveryImportInput;
	result?: DiscoveryImportResult;
	error?: string;
};

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	const { executeOpportunityDiscoveryImport } = await import("@/lib/services/opportunity-discovery-import");
	const { closeDatabaseConnection } = await import("@/lib/db");
	const proof: LiveDiscoveryImportProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		assigneeUserId: discoveryImportUserId(),
		organizationId: discoveryImportOrganizationId(),
		input: liveDiscoveryImportInput(),
	};

	try {
		proof.result = await executeOpportunityDiscoveryImport(
			proof.input,
			proof.assigneeUserId,
			proof.organizationId
		);
		if (proof.result.results.total === 0) {
			throw new Error("Broad live discovery import produced zero candidate records");
		}
		proof.completedAt = new Date().toISOString();
		await writeArtifacts(proof, "pass");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		await writeArtifacts(proof, "fail");
		throw error;
	} finally {
		await closeDatabaseConnection().catch(() => undefined);
	}
}

function forceLocalEnv(keys: string[]): void {
	const filePath = path.resolve(process.cwd(), ".env.local");
	if (!fs.existsSync(filePath)) return;
	const wanted = new Set(keys);
	for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const equalsAt = trimmed.indexOf("=");
		if (equalsAt <= 0) continue;
		const key = trimmed.slice(0, equalsAt).trim();
		if (!wanted.has(key)) continue;
		process.env[key] = unquoteEnvValue(trimmed.slice(equalsAt + 1).trim());
	}
}

function unquoteEnvValue(value: string): string {
	if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	return value;
}

function discoveryImportUserId(): string {
	return process.env.DISCOVERY_IMPORT_USER_ID?.trim()
		|| process.env.LIVE_DISCOVERY_IMPORT_USER_ID?.trim()
		|| "system";
}

function discoveryImportOrganizationId(): string {
	return process.env.DISCOVERY_IMPORT_ORGANIZATION_ID?.trim()
		|| process.env.LIVE_DISCOVERY_IMPORT_ORGANIZATION_ID?.trim()
		|| "__MIGRATED_LEGACY__";
}

function liveDiscoveryImportInput(): DiscoveryImportInput {
	return withDefaultDiscoveryRuntimeOptions({
		limitPerQuery: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_LIMIT_PER_QUERY, 10, 1, 50),
		sourceScrapeLimit: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT, 15, 0, 50),
		scrapeLimit: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT, 5, 0, 20),
		browserFallbackLimit: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT, 5, 0, 20),
		downloadLimit: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_DOWNLOAD_LIMIT, 5, 0, 10),
		downloadDiscoveredDocuments: process.env.LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS === "0"
			? false
			: undefined,
		sourceUrls: sourceUrlsFromEnv(),
	});
}

function sourceUrlsFromEnv(): string[] | undefined {
	const raw = process.env.LIVE_DISCOVERY_IMPORT_SOURCE_URLS?.trim();
	if (!raw) return undefined;
	const urls = raw.split(",").map((url) => url.trim()).filter(Boolean);
	return urls.length > 0 ? urls : [...DEFAULT_DISCOVERY_SOURCE_URLS];
}

function boundedNumber(
	raw: string | undefined,
	defaultValue: number,
	min: number,
	max: number
): number {
	const parsed = raw === undefined ? defaultValue : Number(raw);
	if (!Number.isFinite(parsed)) return defaultValue;
	return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

async function writeArtifacts(
	proof: LiveDiscoveryImportProof,
	disposition: EvidenceRecord["disposition"]
): Promise<void> {
	const rawPath = await writeProofJson(LOG_DIR, "live-discovery-import.json", proof);
	const result = proof.result;
	const health = result?.sourceHealth ?? [];
	const degraded = health.filter((source) => source.status === "degraded").length;
	const empty = health.filter((source) => source.status === "empty").length;
	const failed = health.filter((source) => source.status === "failed").length;
	const notes = result
		? [
			`records:${result.results.total}`,
			`imported:${result.results.imported}`,
			`updated:${result.results.updated}`,
			`skipped:${result.results.skipped}`,
			`failed:${result.results.failed}`,
			`source_docs:${result.sourceDocumentsCreated}/${result.sourceDocumentsDownloaded}`,
			`warnings:${result.warnings.length}`,
			`sources:${health.length}`,
			`degraded:${degraded}`,
			`empty:${empty}`,
			`source_failed:${failed}`,
		].join(" ")
		: proof.error ?? "Live discovery import failed before result capture.";

	await appendEvidenceRecords(
		EVIDENCE_PATH,
		[{
			facility: "opportunity-discovery",
			journey: "broad-live-discovery-import",
			run_id: proof.runId,
			artifact_ids: [rawPath],
			topology_tier: "live-safe",
			verification_bucket: "live broad RFP collection",
			timestamp: new Date().toISOString(),
			operator: "codex",
			cleanup_status: "not-applicable",
			disposition,
			notes,
		}],
		{ title: "Live Discovery Import Evidence" }
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
