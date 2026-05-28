import "./load-env";

import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/lib/db/schema";
import { forceLocalEnv } from "./env-utils";

type ZeroRequirementRow = {
	id: string;
	organization_id: string;
	filename: string;
	parsing_confidence: number | null;
	metadata: unknown;
	parsing_job_id: string;
	requirements_extracted: number | null;
};

type ParseReviewMetadata = {
	state?: string;
	confidence?: number;
	threshold?: number;
	qualitySignals?: string[];
	reason?: string;
	[key: string]: unknown;
};

const QUALITY_SIGNAL_ZERO_REQUIREMENTS = "zero_requirements_extracted";

type Runtime = {
	db: NodePgDatabase<typeof schema>;
	closeDatabaseConnection: () => Promise<void>;
	rfpDocuments: typeof schema.rfpDocuments;
};

let runtime: Runtime | undefined;

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	runtime = await loadRuntime();
	const limit = boundedNumber(process.env.RFP_PARSE_QUALITY_AUDIT_LIMIT, 25, 1, 250);
	const dryRun = process.env.RFP_PARSE_QUALITY_AUDIT_DRY_RUN === "1";
	const rows = await findCompletedZeroRequirementParses(limit);
	const repaired: Array<{ id: string; filename: string; parsingJobId: string; dryRun: boolean }> = [];

	for (const row of rows) {
		const metadata = normalizeMetadata(row.metadata);
		const parseReview = normalizeParseReview(metadata.parseReview, row.parsing_confidence);
		if (parseReview.qualitySignals?.includes(QUALITY_SIGNAL_ZERO_REQUIREMENTS)) {
			continue;
		}

		const nextReview = withZeroRequirementSignal(parseReview);
		repaired.push({
			id: row.id,
			filename: row.filename,
			parsingJobId: row.parsing_job_id,
			dryRun,
		});

		if (!dryRun) {
			await runtime.db.update(runtime.rfpDocuments).set({
				metadata: {
					...metadata,
					parseReview: nextReview,
					parseQualityAudit: {
						checkedAt: new Date().toISOString(),
						source: "audit-rfp-parse-quality",
						latestParsingJobId: row.parsing_job_id,
						requirementsExtracted: row.requirements_extracted ?? 0,
					},
				},
				updatedAt: new Date(),
			}).where(and(
				eq(runtime.rfpDocuments.id, row.id),
				eq(runtime.rfpDocuments.organizationId, row.organization_id),
			));
		}
	}

	console.log(JSON.stringify({
		dryRun,
		scanned: rows.length,
		repaired: repaired.length,
		items: repaired,
	}, null, 2));
}

async function loadRuntime(): Promise<Runtime> {
	const dbModule = await import("@/lib/db");
	const schemaModule = await import("@/lib/db/schema");
	return {
		db: dbModule.db,
		closeDatabaseConnection: dbModule.closeDatabaseConnection,
		rfpDocuments: schemaModule.rfpDocuments,
	};
}

async function findCompletedZeroRequirementParses(limit: number): Promise<ZeroRequirementRow[]> {
	if (!runtime) throw new Error("Runtime not initialized");
	const result = await runtime.db.execute(sql<ZeroRequirementRow>`
		SELECT
			d.id::text,
			d.organization_id,
			d.filename,
			d.parsing_confidence,
			d.metadata,
			j.id::text AS parsing_job_id,
			j.requirements_extracted
		FROM rfp_documents d
		JOIN LATERAL (
			SELECT id, requirements_extracted, created_at
			FROM rfp_parsing_jobs
			WHERE rfp_document_id = d.id
			ORDER BY created_at DESC
			LIMIT 1
		) j ON TRUE
		WHERE d.parsing_status = 'completed'
		  AND COALESCE(j.requirements_extracted, 0) = 0
		  AND NOT COALESCE(d.metadata->'parseReview'->'qualitySignals', '[]'::jsonb) ? ${QUALITY_SIGNAL_ZERO_REQUIREMENTS}
		ORDER BY d.created_at DESC
		LIMIT ${limit}
	`);
	return result.rows as ZeroRequirementRow[];
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};
}

function normalizeParseReview(value: unknown, fallbackConfidence: number | null): ParseReviewMetadata {
	const record = value && typeof value === "object" && !Array.isArray(value)
		? value as ParseReviewMetadata
		: {};
	const threshold = typeof record.threshold === "number" ? record.threshold : getParseConfidenceGateThreshold();
	const confidence = typeof record.confidence === "number" ? record.confidence : fallbackConfidence ?? 0;
	return {
		...record,
		state: typeof record.state === "string" ? record.state : confidence >= threshold ? "auto_accepted" : "needs_review",
		confidence,
		threshold,
		qualitySignals: Array.isArray(record.qualitySignals)
			? record.qualitySignals.filter((signal): signal is string => typeof signal === "string")
			: [],
	};
}

function withZeroRequirementSignal(parseReview: ParseReviewMetadata): ParseReviewMetadata {
	const qualitySignals = new Set(parseReview.qualitySignals ?? []);
	qualitySignals.add(QUALITY_SIGNAL_ZERO_REQUIREMENTS);
	return {
		...parseReview,
		state: parseReview.state === "accepted" ? "correction_requested" : "needs_review",
		qualitySignals: [...qualitySignals],
		reason: parseReview.reason ?? "Parser completed without extracting any actionable requirements.",
	};
}

function getParseConfidenceGateThreshold(): number {
	const parsed = Number(process.env.RFP_PARSE_CONFIDENCE_GATE ?? 80);
	return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 80;
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
