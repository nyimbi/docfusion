import "./load-env";

import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/lib/db/schema";
import { isLowValueProcurementDocumentLink } from "@/lib/services/rfp-document-link-filter";
import { forceLocalEnv } from "./env-utils";

type Runtime = {
	db: NodePgDatabase<typeof schema>;
	closeDatabaseConnection: () => Promise<void>;
	rfpParsingJobs: typeof schema.rfpParsingJobs;
	processRfpParsingJob: typeof import("@/lib/actions/rfp-parser").processRfpParsingJob;
};

type QueuedParseRow = {
	jobId: string;
	rfpDocumentId: string;
	organizationId: string;
	filename: string;
	queuedAt: Date;
	currentStep: string | null;
};

type ProcessQueuedResult = {
	jobId: string;
	rfpDocumentId: string;
	organizationId: string;
	filename: string;
	dryRun: boolean;
	status: "dry_run" | "completed" | "failed";
	error?: string;
	requirementsExtracted?: number | null;
};

type QueuedParseSelection = {
	rows: QueuedParseRow[];
	candidateLimit: number;
	skippedLowValueCandidates: number;
};

const RUN_ID = process.env.RFP_PARSE_QUEUE_RUN_ID ?? `rfp_parse_queue_${new Date().toISOString().replace(/[:.]/g, "-")}`;
const LIMIT = boundedNumber(process.env.RFP_PARSE_QUEUE_LIMIT, 10, 1, 100);
const DRY_RUN = process.env.RFP_PARSE_QUEUE_DRY_RUN !== "0";
const USER_ID = (process.env.RFP_PARSE_QUEUE_USER_ID ?? "system").slice(0, 100);
const ORGANIZATION_ID = process.env.RFP_PARSE_QUEUE_ORGANIZATION_ID?.trim();
const SKIP_LOW_VALUE = process.env.RFP_PARSE_QUEUE_SKIP_LOW_VALUE !== "0";

let runtime: Runtime | undefined;

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	runtime = await loadRuntime();
	const selection = await findQueuedParses();
	const queued = selection.rows;
	const results: ProcessQueuedResult[] = [];

	try {
		for (const row of queued) {
			if (DRY_RUN) {
				results.push({
					jobId: row.jobId,
					rfpDocumentId: row.rfpDocumentId,
					organizationId: row.organizationId,
					filename: row.filename,
					dryRun: true,
					status: "dry_run",
				});
				continue;
			}

			const parseResult = await runtime.processRfpParsingJob({
				jobId: row.jobId,
				rfpDocumentId: row.rfpDocumentId,
				tenantContext: {
					userId: USER_ID,
					organizationId: row.organizationId,
				},
			});
			const [job] = await runtime.db
				.select({ requirementsExtracted: runtime.rfpParsingJobs.requirementsExtracted })
				.from(runtime.rfpParsingJobs)
				.where(and(
					eq(runtime.rfpParsingJobs.id, row.jobId),
					eq(runtime.rfpParsingJobs.organizationId, row.organizationId)
				))
				.limit(1);
			results.push({
				jobId: row.jobId,
				rfpDocumentId: row.rfpDocumentId,
				organizationId: row.organizationId,
				filename: row.filename,
				dryRun: false,
				status: parseResult.status,
				error: parseResult.error,
				requirementsExtracted: job?.requirementsExtracted ?? null,
			});
		}
	} finally {
		await runtime.closeDatabaseConnection().catch(() => undefined);
	}

	console.log(JSON.stringify({
		runId: RUN_ID,
		dryRun: DRY_RUN,
		limit: LIMIT,
		skipLowValue: SKIP_LOW_VALUE,
		candidateLimit: selection.candidateLimit,
		skippedLowValueCandidates: selection.skippedLowValueCandidates,
		selected: queued.length,
		completed: results.filter((result) => result.status === "completed").length,
		failed: results.filter((result) => result.status === "failed").length,
		results,
	}, null, 2));

	if (results.some((result) => result.status === "failed")) {
		process.exitCode = 1;
	}
}

async function loadRuntime(): Promise<Runtime> {
	const [dbModule, schemaModule, parserModule] = await Promise.all([
		import("@/lib/db"),
		import("@/lib/db/schema"),
		import("@/lib/actions/rfp-parser"),
	]);
	return {
		db: dbModule.db,
		closeDatabaseConnection: dbModule.closeDatabaseConnection,
		rfpParsingJobs: schemaModule.rfpParsingJobs,
		processRfpParsingJob: parserModule.processRfpParsingJob,
	};
}

async function findQueuedParses(): Promise<QueuedParseSelection> {
	if (!runtime) throw new Error("Runtime not initialized");
	const orgCondition = ORGANIZATION_ID
		? sql`AND d.organization_id = ${ORGANIZATION_ID}`
		: sql``;
	const candidateLimit = SKIP_LOW_VALUE ? Math.min(500, LIMIT * 10) : LIMIT;
	const result = await runtime.db.execute(sql<QueuedParseRow>`
		SELECT
			j.id::text AS "jobId",
			d.id::text AS "rfpDocumentId",
			d.organization_id AS "organizationId",
			d.filename,
			j.queued_at AS "queuedAt",
			j.current_step AS "currentStep"
		FROM rfp_parsing_jobs j
		JOIN rfp_documents d ON d.id = j.rfp_document_id
		WHERE j.status = 'queued'
		  AND d.parsing_status IN ('pending', 'processing')
		  AND NOT EXISTS (
			SELECT 1
			FROM rfp_parsing_jobs newer
			WHERE newer.rfp_document_id = j.rfp_document_id
			  AND newer.organization_id = j.organization_id
			  AND newer.created_at > j.created_at
		  )
		  ${orgCondition}
		ORDER BY j.queued_at ASC, j.created_at ASC
		LIMIT ${candidateLimit}
	`);
	const rows = result.rows as QueuedParseRow[];
	if (!SKIP_LOW_VALUE) {
		return {
			rows: rows.slice(0, LIMIT),
			candidateLimit,
			skippedLowValueCandidates: 0,
		};
	}

	const selected: QueuedParseRow[] = [];
	let skippedLowValueCandidates = 0;
	for (const row of rows) {
		if (isLowValueProcurementDocumentLink({ label: row.filename, url: row.filename })) {
			skippedLowValueCandidates++;
			continue;
		}
		selected.push(row);
		if (selected.length >= LIMIT) break;
	}
	return {
		rows: selected,
		candidateLimit,
		skippedLowValueCandidates,
	};
}

function boundedNumber(raw: string | undefined, defaultValue: number, min: number, max: number): number {
	const parsed = raw === undefined ? defaultValue : Number(raw);
	if (!Number.isFinite(parsed)) return defaultValue;
	return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

main().catch(async (error) => {
	await runtime?.closeDatabaseConnection().catch(() => undefined);
	console.error(error);
	process.exitCode = 1;
});
