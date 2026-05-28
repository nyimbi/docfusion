import "./load-env";

import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { opportunityDocuments, rfpParsingJobs } from "@/lib/db/schema";
import { forceLocalEnv } from "./env-utils";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.SOURCE_DOCUMENT_INTAKE_RUN_ID ?? createProofRunId("source_document_intake");
const LOG_DIR = createProofLogDir({ workspaceRoot: WORKSPACE_ROOT, runId: RUN_ID, wave: "source-document-intake" });
const EVIDENCE_PATH = path.resolve(WORKSPACE_ROOT, ".omx", "state", "platform-source-document-intake-evidence.md");
const SUPPORTED_DOCUMENT_PATTERNS = [".pdf", ".docx", ".html", ".htm"];

type IntakeDisposition = "downloaded" | "failed" | "skipped";

type IntakeResult = {
	documentId: string;
	opportunityId: string;
	organizationId: string | null;
	documentName: string;
	sourceUrl: string;
	disposition: IntakeDisposition;
	success: boolean;
	error?: string;
	rfpDocumentId?: string;
	parsingJobId?: string;
	parseWait?: ParseWaitResult;
};

type ParseWaitResult = {
	status: string;
	progress: number;
	currentStep: string | null;
	requirementsExtracted: number | null;
	errorMessage: string | null;
	timedOut: boolean;
};

type Runtime = {
	db: NodePgDatabase<typeof schema>;
	closeDatabaseConnection: () => Promise<void>;
	downloadDocument: typeof import("@/lib/services/rfp-document-service").downloadDocument;
};

type SourceDocumentIntakeProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	config: {
		limit: number;
		maxAttempts: number;
		userId: string;
		organizationId?: string;
		waitForParse: boolean;
		parseTimeoutMs: number;
		pollMs: number;
		parseDrainMs: number;
		dryRun: boolean;
		retryFailed: boolean;
	};
	selected: Array<{
		id: string;
		opportunityId: string;
		organizationId: string | null;
		documentName: string;
		sourceUrl: string;
		downloadAttempts: number;
	}>;
	results: IntakeResult[];
	summary: {
		selected: number;
		downloaded: number;
		failed: number;
		skipped: number;
		parseCompleted: number;
		parseFailed: number;
		parseTimedOut: number;
	};
	error?: string;
};

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	const runtime = await loadRuntime();
	const proof: SourceDocumentIntakeProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		config: {
			limit: boundedNumber(process.env.SOURCE_DOCUMENT_INTAKE_LIMIT, 5, 1, 25),
			maxAttempts: boundedNumber(process.env.SOURCE_DOCUMENT_INTAKE_MAX_ATTEMPTS, 3, 1, 10),
			userId: process.env.SOURCE_DOCUMENT_INTAKE_USER_ID?.trim() || "system",
			organizationId: process.env.SOURCE_DOCUMENT_INTAKE_ORGANIZATION_ID?.trim() || undefined,
			waitForParse: process.env.SOURCE_DOCUMENT_INTAKE_WAIT_FOR_PARSE === "0" ? false : true,
			parseTimeoutMs: boundedNumber(process.env.SOURCE_DOCUMENT_INTAKE_PARSE_TIMEOUT_MS, 180_000, 5_000, 600_000),
			pollMs: boundedNumber(process.env.SOURCE_DOCUMENT_INTAKE_POLL_MS, 2_500, 500, 30_000),
			parseDrainMs: boundedNumber(process.env.SOURCE_DOCUMENT_INTAKE_PARSE_DRAIN_MS, 2_000, 0, 30_000),
			dryRun: process.env.SOURCE_DOCUMENT_INTAKE_DRY_RUN === "1",
			retryFailed: process.env.SOURCE_DOCUMENT_INTAKE_RETRY_FAILED === "0" ? false : true,
		},
		selected: [],
		results: [],
		summary: {
			selected: 0,
			downloaded: 0,
			failed: 0,
			skipped: 0,
			parseCompleted: 0,
			parseFailed: 0,
			parseTimedOut: 0,
		},
	};

	try {
		const selected = await selectDiscoveredDocuments(runtime.db, proof.config);
		proof.selected = selected;
		proof.summary.selected = selected.length;

		for (const document of selected) {
			if (proof.config.dryRun) {
				proof.results.push({
					documentId: document.id,
					opportunityId: document.opportunityId,
					organizationId: document.organizationId,
					documentName: document.documentName,
					sourceUrl: document.sourceUrl,
					disposition: "skipped",
					success: true,
				});
				continue;
			}

			proof.results.push(await ingestDocument(runtime, document, proof.config));
		}

		proof.completedAt = new Date().toISOString();
		proof.summary = summarizeResults(proof);
		await writeArtifacts(proof, shouldPass(proof) ? "pass" : "fail");
		console.log(JSON.stringify(proof, null, 2));
	} catch (error) {
		proof.error = error instanceof Error ? error.message : String(error);
		proof.summary = summarizeResults(proof);
		await writeArtifacts(proof, "fail");
		throw error;
	} finally {
		await runtime.closeDatabaseConnection().catch(() => undefined);
	}
}

async function loadRuntime(): Promise<Runtime> {
	const dbModule = await import("@/lib/db");
	const documentService = await import("@/lib/services/rfp-document-service");
	return {
		db: dbModule.db,
		closeDatabaseConnection: dbModule.closeDatabaseConnection,
		downloadDocument: documentService.downloadDocument,
	};
}

async function selectDiscoveredDocuments(
	db: Runtime["db"],
	config: SourceDocumentIntakeProof["config"]
) {
	const extensionCondition = or(
		...SUPPORTED_DOCUMENT_PATTERNS.flatMap((extension) => [
			ilike(opportunityDocuments.documentName, `%${extension}%`),
			ilike(opportunityDocuments.sourceUrl, `%${extension}%`),
		])
	);
	const conditions = [
		config.retryFailed
			? inArray(opportunityDocuments.status, ["discovered", "failed"])
			: eq(opportunityDocuments.status, "discovered"),
		eq(opportunityDocuments.isSelected, true),
		lt(opportunityDocuments.downloadAttempts, config.maxAttempts),
		sql`${opportunityDocuments.sourceUrl} is not null`,
		extensionCondition,
	];
	if (config.organizationId) {
		conditions.push(eq(opportunityDocuments.organizationId, config.organizationId));
	}

	return db
		.select({
			id: opportunityDocuments.id,
			opportunityId: opportunityDocuments.opportunityId,
			organizationId: opportunityDocuments.organizationId,
			documentName: opportunityDocuments.documentName,
			sourceUrl: opportunityDocuments.sourceUrl,
			downloadAttempts: opportunityDocuments.downloadAttempts,
		})
		.from(opportunityDocuments)
		.where(and(...conditions))
		.orderBy(desc(opportunityDocuments.discoveredAt), desc(opportunityDocuments.createdAt))
		.limit(config.limit);
}

async function ingestDocument(
	runtime: Runtime,
	document: SourceDocumentIntakeProof["selected"][number],
	config: SourceDocumentIntakeProof["config"]
): Promise<IntakeResult> {
	try {
		const result = await runtime.downloadDocument(document.id, config.userId, document.opportunityId);
		const parseWait = result.parsingJobId && config.waitForParse
			? await waitForParseCompletion(runtime.db, result.parsingJobId, config)
			: undefined;

		return {
			documentId: document.id,
			opportunityId: document.opportunityId,
			organizationId: document.organizationId,
			documentName: document.documentName,
			sourceUrl: document.sourceUrl,
			disposition: result.success ? "downloaded" : "failed",
			success: result.success,
			error: result.error,
			rfpDocumentId: result.rfpDocumentId,
			parsingJobId: result.parsingJobId,
			parseWait,
		};
	} catch (error) {
		return {
			documentId: document.id,
			opportunityId: document.opportunityId,
			organizationId: document.organizationId,
			documentName: document.documentName,
			sourceUrl: document.sourceUrl,
			disposition: "failed",
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function waitForParseCompletion(
	db: Runtime["db"],
	parsingJobId: string,
	config: SourceDocumentIntakeProof["config"]
): Promise<ParseWaitResult> {
	const deadline = Date.now() + config.parseTimeoutMs;
	let latest: ParseWaitResult | undefined;

	while (Date.now() <= deadline) {
		const [job] = await db
			.select({
				status: rfpParsingJobs.status,
				progress: rfpParsingJobs.progress,
				currentStep: rfpParsingJobs.currentStep,
				requirementsExtracted: rfpParsingJobs.requirementsExtracted,
				errorMessage: rfpParsingJobs.errorMessage,
			})
			.from(rfpParsingJobs)
			.where(eq(rfpParsingJobs.id, parsingJobId))
			.limit(1);

		if (!job) {
			return {
				status: "missing",
				progress: 0,
				currentStep: null,
				requirementsExtracted: null,
				errorMessage: "Parsing job disappeared before completion",
				timedOut: false,
			};
		}

		latest = {
			status: job.status,
			progress: job.progress,
			currentStep: job.currentStep,
			requirementsExtracted: job.requirementsExtracted,
			errorMessage: job.errorMessage,
			timedOut: false,
		};

		if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
			if (config.parseDrainMs > 0) {
				await sleep(config.parseDrainMs);
			}
			return latest;
		}

		await sleep(config.pollMs);
	}

	return {
		status: latest?.status ?? "unknown",
		progress: latest?.progress ?? 0,
		currentStep: latest?.currentStep ?? null,
		requirementsExtracted: latest?.requirementsExtracted ?? null,
		errorMessage: latest?.errorMessage ?? "Timed out waiting for parse completion",
		timedOut: true,
	};
}

function summarizeResults(proof: SourceDocumentIntakeProof): SourceDocumentIntakeProof["summary"] {
	return {
		selected: proof.selected.length,
		downloaded: proof.results.filter((result) => result.disposition === "downloaded").length,
		failed: proof.results.filter((result) => result.disposition === "failed").length,
		skipped: proof.results.filter((result) => result.disposition === "skipped").length,
		parseCompleted: proof.results.filter((result) => result.parseWait?.status === "completed").length,
		parseFailed: proof.results.filter((result) => result.parseWait?.status === "failed").length,
		parseTimedOut: proof.results.filter((result) => result.parseWait?.timedOut).length,
	};
}

function shouldPass(proof: SourceDocumentIntakeProof): boolean {
	if (proof.config.dryRun || proof.selected.length === 0) return true;
	return proof.results.some((result) => result.success);
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
	proof: SourceDocumentIntakeProof,
	disposition: EvidenceRecord["disposition"]
): Promise<void> {
	const rawPath = await writeProofJson(LOG_DIR, "source-document-intake.json", proof);
	const notes = proof.error
		? proof.error
		: [
			`selected:${proof.summary.selected}`,
			`downloaded:${proof.summary.downloaded}`,
			`failed:${proof.summary.failed}`,
			`skipped:${proof.summary.skipped}`,
			`parse_completed:${proof.summary.parseCompleted}`,
			`parse_failed:${proof.summary.parseFailed}`,
			`parse_timed_out:${proof.summary.parseTimedOut}`,
		].join(" ");

	await appendEvidenceRecords(
		EVIDENCE_PATH,
		[{
			facility: "rfp-source-document-intake",
			journey: "discovered-document-download-and-parse",
			run_id: proof.runId,
			artifact_ids: [rawPath],
			topology_tier: "live-safe",
			verification_bucket: "live RFP source document intake",
			timestamp: new Date().toISOString(),
			operator: "codex",
			cleanup_status: "not-applicable",
			disposition,
			notes,
		}],
		{ title: "Source Document Intake Evidence" }
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
