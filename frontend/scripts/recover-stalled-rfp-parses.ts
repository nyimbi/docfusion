import "./load-env";

import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/lib/db/schema";
import { forceLocalEnv } from "./env-utils";

type Runtime = {
	db: NodePgDatabase<typeof schema>;
	closeDatabaseConnection: () => Promise<void>;
	rfpDocuments: typeof schema.rfpDocuments;
	rfpParsingJobs: typeof schema.rfpParsingJobs;
	processRfpParsingJob: typeof import("@/lib/actions/rfp-parser").processRfpParsingJob;
};

type StalledParseRow = {
	job_id: string;
	rfp_document_id: string;
	organization_id: string;
	filename: string;
	progress: number;
	current_step: string | null;
	parsing_options: unknown;
	job_metadata: unknown;
	document_metadata: unknown;
	updated_at: Date;
	stalled_minutes: number;
};

type RecoveryResult = {
	rfpDocumentId: string;
	filename: string;
	organizationId: string;
	stalledJobId: string;
	retryJobId?: string;
	dryRun: boolean;
	startedRetry: boolean;
	status: "dry_run" | "requeued" | "completed" | "failed";
	error?: string;
	requirementsExtracted?: number | null;
};

const RUN_ID = process.env.RFP_PARSE_STALL_RECOVERY_RUN_ID ?? `rfp_parse_stall_recovery_${new Date().toISOString().replace(/[:.]/g, "-")}`;
const LIMIT = boundedNumber(process.env.RFP_PARSE_STALL_RECOVERY_LIMIT, 25, 1, 250);
const STALE_AFTER_MINUTES = boundedNumber(process.env.RFP_PARSE_STALL_RECOVERY_STALE_AFTER_MINUTES, 30, 5, 24 * 60);
const DRY_RUN = process.env.RFP_PARSE_STALL_RECOVERY_DRY_RUN !== "0";
const START_PROCESSING = process.env.RFP_PARSE_STALL_RECOVERY_START_PROCESSING !== "0";
const USER_ID = (process.env.RFP_PARSE_STALL_RECOVERY_USER_ID ?? "system").slice(0, 100);
const ORGANIZATION_ID = process.env.RFP_PARSE_STALL_RECOVERY_ORGANIZATION_ID?.trim();

let runtime: Runtime | undefined;

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	runtime = await loadRuntime();

	const stalled = await findStalledParses();
	const results: RecoveryResult[] = [];

	for (const row of stalled) {
		if (DRY_RUN) {
			results.push({
				rfpDocumentId: row.rfp_document_id,
				filename: row.filename,
				organizationId: row.organization_id,
				stalledJobId: row.job_id,
				dryRun: true,
				startedRetry: false,
				status: "dry_run",
			});
			continue;
		}

		const retryJobId = await requeueStalledParse(row);
		if (!retryJobId) {
			results.push({
				rfpDocumentId: row.rfp_document_id,
				filename: row.filename,
				organizationId: row.organization_id,
				stalledJobId: row.job_id,
				dryRun: false,
				startedRetry: false,
				status: "failed",
				error: "Stalled job was no longer recoverable.",
			});
			continue;
		}

		if (!START_PROCESSING) {
			results.push({
				rfpDocumentId: row.rfp_document_id,
				filename: row.filename,
				organizationId: row.organization_id,
				stalledJobId: row.job_id,
				retryJobId,
				dryRun: false,
				startedRetry: false,
				status: "requeued",
			});
			continue;
		}

		const retryResult = await runtime.processRfpParsingJob({
			jobId: retryJobId,
			rfpDocumentId: row.rfp_document_id,
			tenantContext: {
				userId: USER_ID,
				organizationId: row.organization_id,
			},
		});

		results.push({
			rfpDocumentId: row.rfp_document_id,
			filename: row.filename,
			organizationId: row.organization_id,
			stalledJobId: row.job_id,
			retryJobId,
			dryRun: false,
			startedRetry: true,
			status: retryResult.status === "completed" ? "completed" : "failed",
			error: retryResult.error,
		});
	}

	if (results.some((result) => result.retryJobId)) {
		await hydrateRequirementsExtracted(results);
	}

	console.log(JSON.stringify({
		runId: RUN_ID,
		dryRun: DRY_RUN,
		startProcessing: START_PROCESSING,
		staleAfterMinutes: STALE_AFTER_MINUTES,
		limit: LIMIT,
		scanned: stalled.length,
		recovered: results.filter((result) => result.status === "completed" || result.status === "requeued").length,
		failed: results.filter((result) => result.status === "failed").length,
		results,
	}, null, 2));
}

async function loadRuntime(): Promise<Runtime> {
	const dbModule = await import("@/lib/db");
	const schemaModule = await import("@/lib/db/schema");
	const parserModule = await import("@/lib/actions/rfp-parser");
	return {
		db: dbModule.db,
		closeDatabaseConnection: dbModule.closeDatabaseConnection,
		rfpDocuments: schemaModule.rfpDocuments,
		rfpParsingJobs: schemaModule.rfpParsingJobs,
		processRfpParsingJob: parserModule.processRfpParsingJob,
	};
}

async function findStalledParses(): Promise<StalledParseRow[]> {
	if (!runtime) throw new Error("Runtime not initialized");
	const orgCondition = ORGANIZATION_ID
		? sql`AND d.organization_id = ${ORGANIZATION_ID}`
		: sql``;
	const result = await runtime.db.execute(sql<StalledParseRow>`
		SELECT
			j.id::text AS job_id,
			d.id::text AS rfp_document_id,
			d.organization_id,
			d.filename,
			j.progress,
			j.current_step,
			j.parsing_options,
			j.metadata AS job_metadata,
			d.metadata AS document_metadata,
			j.updated_at,
			EXTRACT(EPOCH FROM (now() - COALESCE(j.updated_at, j.started_at, j.created_at))) / 60 AS stalled_minutes
		FROM rfp_parsing_jobs j
		JOIN rfp_documents d ON d.id = j.rfp_document_id
		WHERE j.status = 'processing'
		  AND d.parsing_status = 'processing'
		  AND COALESCE(j.updated_at, j.started_at, j.created_at) < now() - (${STALE_AFTER_MINUTES} * interval '1 minute')
		  ${orgCondition}
		ORDER BY COALESCE(j.updated_at, j.started_at, j.created_at) ASC
		LIMIT ${LIMIT}
	`);
	return result.rows as StalledParseRow[];
}

async function requeueStalledParse(row: StalledParseRow): Promise<string | undefined> {
	if (!runtime) throw new Error("Runtime not initialized");
	const now = new Date();
	const reason = `Superseded stalled parse job ${row.job_id} after ${Math.round(row.stalled_minutes)} minutes without progress.`;

	return runtime.db.transaction(async (tx) => {
		const [stalledJob] = await tx.update(runtime!.rfpParsingJobs)
			.set({
				status: "failed",
				errorMessage: reason,
				completedAt: now,
				metadata: {
					...normalizeMetadata(row.job_metadata),
					stalledRecovery: {
						runId: RUN_ID,
						recoveredAt: now.toISOString(),
						retry: true,
						reason,
					},
				},
				updatedAt: now,
			})
			.where(and(
				eq(runtime!.rfpParsingJobs.id, row.job_id),
				eq(runtime!.rfpParsingJobs.organizationId, row.organization_id),
				eq(runtime!.rfpParsingJobs.status, "processing"),
			))
			.returning({ id: runtime!.rfpParsingJobs.id });

		if (!stalledJob) return undefined;

		const [retryJob] = await tx.insert(runtime!.rfpParsingJobs)
			.values({
				organizationId: row.organization_id,
				rfpDocumentId: row.rfp_document_id,
				status: "queued",
				currentStep: "Queued after stall recovery",
				progress: 0,
				initiatedBy: USER_ID,
				parsingOptions: row.parsing_options ?? {
					extractRequirements: true,
					generateEmbeddings: true,
					detectSections: true,
					classifyRequirements: true,
				},
				metadata: {
					stalledRecoveryOfJobId: row.job_id,
					reason,
					runId: RUN_ID,
				},
			})
			.returning({ id: runtime!.rfpParsingJobs.id });

		await tx.update(runtime!.rfpDocuments)
			.set({
				parsingStatus: "pending",
				parsingProgress: 0,
				parsingError: null,
				parsingStartedAt: null,
				parsingCompletedAt: null,
				metadata: {
					...normalizeMetadata(row.document_metadata),
					parseStallRecovery: {
						runId: RUN_ID,
						recoveredAt: now.toISOString(),
						stalledJobId: row.job_id,
						retryJobId: retryJob.id,
						reason,
					},
				},
				updatedAt: now,
			})
			.where(and(
				eq(runtime!.rfpDocuments.id, row.rfp_document_id),
				eq(runtime!.rfpDocuments.organizationId, row.organization_id),
			));

		return retryJob.id;
	});
}

async function hydrateRequirementsExtracted(results: RecoveryResult[]): Promise<void> {
	if (!runtime) throw new Error("Runtime not initialized");
	for (const result of results) {
		if (!result.retryJobId) continue;
		const [job] = await runtime.db
			.select({
				requirementsExtracted: runtime.rfpParsingJobs.requirementsExtracted,
			})
			.from(runtime.rfpParsingJobs)
			.where(eq(runtime.rfpParsingJobs.id, result.retryJobId))
			.limit(1);
		result.requirementsExtracted = job?.requirementsExtracted ?? null;
	}
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}

function boundedNumber(raw: string | undefined, defaultValue: number, min: number, max: number): number {
	const parsed = raw === undefined ? defaultValue : Number(raw);
	if (!Number.isFinite(parsed)) return defaultValue;
	return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await runtime?.closeDatabaseConnection().catch(() => undefined);
	});
