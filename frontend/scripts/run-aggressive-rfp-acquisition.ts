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
import {
	buildAggressiveRfpAcquisitionInputs,
	DEFAULT_AFRICA_GLOBAL_SOUTH_RFP_CAMPAIGN_IDS,
	type AggressiveRfpAcquisitionOptions,
} from "@/lib/services/aggressive-rfp-acquisition";
import type { DiscoveryImportResult } from "@/lib/services/opportunity-discovery-import";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.AGGRESSIVE_RFP_ACQUISITION_RUN_ID ?? createProofRunId("aggressive_rfp_acquisition");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "aggressive-rfp-acquisition" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-aggressive-rfp-acquisition-evidence.md");

type CampaignRun = {
	id: string;
	label: string;
	startedAt: string;
	completedAt?: string;
	result?: DiscoveryImportResult;
	error?: string;
};

type AggressiveRfpAcquisitionProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	assigneeUserId: string;
	organizationId: string;
	options: AggressiveRfpAcquisitionOptions;
	campaigns: CampaignRun[];
	summary: {
		campaigns: number;
		completed: number;
		failed: number;
		records: number;
		imported: number;
		updated: number;
		sourceDocumentsCreated: number;
		sourceDocumentsDownloaded: number;
		sourceDocumentsDownloadFailed: number;
		sourceDocumentsParsed: number;
		sourceDocumentsParseFailed: number;
		warnings: number;
	};
	error?: string;
};

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	const { executeOpportunityDiscoveryImport } = await import("@/lib/services/opportunity-discovery-import");
	const { closeDatabaseConnection } = await import("@/lib/db");

	const proof: AggressiveRfpAcquisitionProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		assigneeUserId: discoveryImportUserId(),
		organizationId: discoveryImportOrganizationId(),
		options: acquisitionOptionsFromEnv(),
		campaigns: [],
		summary: emptySummary(),
	};

	try {
		for (const { campaign, input } of buildAggressiveRfpAcquisitionInputs(proof.options)) {
			const campaignRun: CampaignRun = {
				id: campaign.id,
				label: campaign.label,
				startedAt: new Date().toISOString(),
			};
			proof.campaigns.push(campaignRun);
			try {
				campaignRun.result = await executeOpportunityDiscoveryImport(
					input,
					proof.assigneeUserId,
					proof.organizationId
				);
			} catch (error) {
				campaignRun.error = error instanceof Error ? error.message : String(error);
			} finally {
				campaignRun.completedAt = new Date().toISOString();
				proof.summary = summarizeProof(proof);
				await writeProofJson(LOG_DIR, `aggressive-rfp-acquisition-${campaign.id}.json`, campaignRun);
			}
		}

		proof.completedAt = new Date().toISOString();
		proof.summary = summarizeProof(proof);
		await writeArtifacts(proof, proof.summary.records > 0 && proof.summary.completed > 0 ? "pass" : "fail");
		console.log(JSON.stringify(proof, null, 2));
		if (proof.summary.records === 0 || proof.summary.completed === 0) {
			process.exitCode = 1;
		}
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		proof.summary = summarizeProof(proof);
		await writeArtifacts(proof, "fail");
		throw error;
	} finally {
		await closeDatabaseConnection().catch(() => undefined);
	}
}

function acquisitionOptionsFromEnv(): AggressiveRfpAcquisitionOptions {
	return {
		campaignIds: parseCsvList(process.env.AGGRESSIVE_RFP_ACQUISITION_GROUPS),
		limitPerQuery: boundedNumber(process.env.AGGRESSIVE_RFP_ACQUISITION_LIMIT_PER_QUERY, 8, 1, 50),
		searchPages: boundedNumber(process.env.AGGRESSIVE_RFP_ACQUISITION_SEARCH_PAGES, 2, 1, 5),
		sourceScrapeLimit: boundedNumber(process.env.AGGRESSIVE_RFP_ACQUISITION_SOURCE_SCRAPE_LIMIT, 40, 0, 500),
		scrapeLimit: boundedNumber(process.env.AGGRESSIVE_RFP_ACQUISITION_SCRAPE_LIMIT, 4, 0, 20),
		browserFallbackLimit: boundedNumber(process.env.AGGRESSIVE_RFP_ACQUISITION_BROWSER_FALLBACK_LIMIT, 4, 0, 20),
		sourceChunkSize: boundedNumber(process.env.AGGRESSIVE_RFP_ACQUISITION_SOURCE_CHUNK_SIZE, 0, 0, 100),
		downloadLimit: process.env.AGGRESSIVE_RFP_ACQUISITION_DOWNLOAD_DOCUMENTS === "0"
			? 0
			: boundedNumber(process.env.AGGRESSIVE_RFP_ACQUISITION_DOWNLOAD_LIMIT, 12, 0, 25),
		downloadParseMode: discoveryImportParseMode(),
	};
}

function discoveryImportUserId(): string {
	return process.env.DISCOVERY_IMPORT_USER_ID?.trim()
		|| process.env.AGGRESSIVE_RFP_ACQUISITION_USER_ID?.trim()
		|| "system";
}

function discoveryImportOrganizationId(): string {
	return process.env.DISCOVERY_IMPORT_ORGANIZATION_ID?.trim()
		|| process.env.AGGRESSIVE_RFP_ACQUISITION_ORGANIZATION_ID?.trim()
		|| "__MIGRATED_LEGACY__";
}

function discoveryImportParseMode(): AggressiveRfpAcquisitionOptions["downloadParseMode"] {
	const raw = process.env.AGGRESSIVE_RFP_ACQUISITION_DOWNLOAD_PARSE_MODE?.trim().toLowerCase();
	if (raw === "background" || raw === "inline" || raw === "queued") return raw;
	return "queued";
}

function parseCsvList(raw: string | undefined): string[] | undefined {
	if (raw === undefined || !raw.trim()) return [...DEFAULT_AFRICA_GLOBAL_SOUTH_RFP_CAMPAIGN_IDS];
	if (raw.trim().toLowerCase() === "all") return undefined;
	const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
	return values.length ? values : undefined;
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

function emptySummary(): AggressiveRfpAcquisitionProof["summary"] {
	return {
		campaigns: 0,
		completed: 0,
		failed: 0,
		records: 0,
		imported: 0,
		updated: 0,
		sourceDocumentsCreated: 0,
		sourceDocumentsDownloaded: 0,
		sourceDocumentsDownloadFailed: 0,
		sourceDocumentsParsed: 0,
		sourceDocumentsParseFailed: 0,
		warnings: 0,
	};
}

function summarizeProof(proof: AggressiveRfpAcquisitionProof): AggressiveRfpAcquisitionProof["summary"] {
	const summary = emptySummary();
	summary.campaigns = proof.campaigns.length;
	for (const campaign of proof.campaigns) {
		if (campaign.result) {
			summary.completed++;
			summary.records += campaign.result.results.total;
			summary.imported += campaign.result.results.imported;
			summary.updated += campaign.result.results.updated;
			summary.sourceDocumentsCreated += campaign.result.sourceDocumentsCreated;
			summary.sourceDocumentsDownloaded += campaign.result.sourceDocumentsDownloaded;
			summary.sourceDocumentsDownloadFailed += campaign.result.sourceDocumentsDownloadFailed;
			summary.sourceDocumentsParsed += campaign.result.sourceDocumentsParsed;
			summary.sourceDocumentsParseFailed += campaign.result.sourceDocumentsParseFailed;
			summary.warnings += campaign.result.warnings.length;
		} else if (campaign.error) {
			summary.failed++;
		}
	}
	return summary;
}

async function writeArtifacts(
	proof: AggressiveRfpAcquisitionProof,
	disposition: EvidenceRecord["disposition"]
): Promise<void> {
	const rawPath = await writeProofJson(LOG_DIR, "aggressive-rfp-acquisition.json", proof);
	const notes = [
		`campaigns:${proof.summary.campaigns}`,
		`completed:${proof.summary.completed}`,
		`failed:${proof.summary.failed}`,
		`records:${proof.summary.records}`,
		`imported:${proof.summary.imported}`,
		`updated:${proof.summary.updated}`,
		`source_docs:${proof.summary.sourceDocumentsCreated}/${proof.summary.sourceDocumentsDownloaded}`,
		`download_failed:${proof.summary.sourceDocumentsDownloadFailed}`,
		`parsed_docs:${proof.summary.sourceDocumentsParsed}`,
		`parse_failed:${proof.summary.sourceDocumentsParseFailed}`,
		`warnings:${proof.summary.warnings}`,
	].join(" ");

	await appendEvidenceRecords(
		EVIDENCE_PATH,
		[{
			facility: "opportunity-discovery",
			journey: "targeted-aggressive-rfp-acquisition",
			run_id: proof.runId,
			artifact_ids: [rawPath],
			topology_tier: "live-safe",
			verification_bucket: "targeted live RFP collection",
			timestamp: new Date().toISOString(),
			operator: "codex",
			cleanup_status: "not-applicable",
			disposition,
			notes,
		}],
		{ title: "Aggressive RFP Acquisition Evidence" }
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
