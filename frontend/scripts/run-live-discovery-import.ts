import "./load-env";

import path from "node:path";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";
import { forceLocalEnv } from "./env-utils";
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
		if (proof.input.downloadParseMode === "inline" && proof.result.sourceDocumentsParseFailed > 0) {
			throw new Error(`Inline source-document parsing failed for ${proof.result.sourceDocumentsParseFailed} downloaded documents`);
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
		searchPages: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_SEARCH_PAGES, 1, 1, 5),
		sourceScrapeLimit: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT, 50, 0, 200),
		scrapeLimit: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT, 5, 0, 20),
		browserFallbackLimit: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT, 5, 0, 20),
		downloadLimit: boundedNumber(process.env.LIVE_DISCOVERY_IMPORT_DOWNLOAD_LIMIT, 20, 0, 25),
		downloadDiscoveredDocuments: process.env.LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS === "0"
			? false
			: undefined,
		downloadParseMode: discoveryImportParseMode(),
		sourceUrls: sourceUrlsFromEnv(),
	});
}

function discoveryImportParseMode(): DiscoveryImportInput["downloadParseMode"] {
	const raw = process.env.LIVE_DISCOVERY_IMPORT_DOWNLOAD_PARSE_MODE?.trim().toLowerCase();
	if (raw === "background" || raw === "inline" || raw === "queued") return raw;
	return process.env.LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS === "0" ? undefined : "queued";
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
			`parsed_docs:${result.sourceDocumentsParsed}/${result.sourceDocumentsParseAttempted}`,
			`parse_failed:${result.sourceDocumentsParseFailed}`,
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
