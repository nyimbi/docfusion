import "./load-env";

import path from "node:path";
import { sql, type SQL } from "drizzle-orm";
import { forceLocalEnv } from "./env-utils";
import {
	appendEvidenceRecords,
	createProofLogDir,
	createProofRunId,
	writeProofJson,
	type EvidenceRecord,
} from "./platform-proof/core";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const RUN_ID = process.env.DGMARKET_SOURCE_IDENTITY_BACKFILL_RUN_ID
	?? createProofRunId("dgmarket_source_identity_backfill");
const LOG_DIR = createProofLogDir({
	workspaceRoot: WORKSPACE_ROOT,
	runId: RUN_ID,
	wave: "dgmarket-source-identity-backfill",
});
const EVIDENCE_PATH = path.resolve(
	WORKSPACE_ROOT,
	".omx",
	"state",
	"platform-source-document-intake-evidence.md",
);
const APPLY = process.env.DGMARKET_SOURCE_IDENTITY_BACKFILL_APPLY === "1";
const LIMIT = boundedNumber(
	process.env.DGMARKET_SOURCE_IDENTITY_BACKFILL_LIMIT,
	100,
	1,
	1000,
);

type BackfillCandidate = {
	id: string;
	title: string;
	source: string | null;
	sourcePlatform: string | null;
	deadline: string | null;
	documentStatuses: Record<string, number>;
};

type BackfillSummary = {
	legacyDgmarketOpportunities: number;
	dgmarketOpportunities: number;
	dgmarketDocumentsByStatus: Record<string, number>;
};

type BackfillProof = {
	runId: string;
	startedAt: string;
	completedAt?: string;
	config: {
		apply: boolean;
		limit: number;
	};
	before: BackfillSummary;
	candidates: BackfillCandidate[];
	updated: BackfillCandidate[];
	after?: BackfillSummary;
	error?: string;
};

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	const { db, closeDatabaseConnection } = await import("@/lib/db");
	const execute = (query: SQL) => db.execute(query);
	const proof: BackfillProof = {
		runId: RUN_ID,
		startedAt: new Date().toISOString(),
		config: {
			apply: APPLY,
			limit: LIMIT,
		},
		before: await summarize(execute),
		candidates: [],
		updated: [],
	};

	try {
		proof.candidates = await selectCandidates(execute);
		if (APPLY && proof.candidates.length > 0) {
			proof.updated = await updateCandidates(execute);
		}
		proof.after = await summarize(execute);
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

async function selectCandidates(
	execute: (query: SQL) => Promise<{ rows?: unknown[] }>
): Promise<BackfillCandidate[]> {
	return rowsOf<BackfillCandidate>(await execute(sql`
		with candidate_ids as (
			select o.id
			from opportunities o
			where (
				o.source = 'source-scrape'
				or o.source_platform = 'Configured Source Scrape'
				or o.source_platform is null
			)
				and (
					o.rfp_link ilike '%dgmarket.com/tender/%'
					or o.portal_url ilike '%dgmarket.com/tender/%'
					or o.document_url ilike '%dgmarket.com/tender/%'
					or o.metadata::text ilike '%dgmarket.com/tender/%'
					or exists (
						select 1
						from opportunity_documents d
						where d.opportunity_id = o.id
							and d.source_url ilike '%dgmarket.com/tender/%'
					)
				)
			order by o.created_at desc
			limit ${LIMIT}
		)
		select
			o.id::text as "id",
			o.title as "title",
			o.source as "source",
			o.source_platform as "sourcePlatform",
			o.deadline::text as "deadline",
			coalesce(
				jsonb_object_agg(coalesce(status_counts.status::text, 'none'), status_counts.count)
					filter (where status_counts.count is not null),
				'{}'::jsonb
			) as "documentStatuses"
		from opportunities o
		join candidate_ids c on c.id = o.id
		left join lateral (
			select d.status, count(*)::integer as count
			from opportunity_documents d
			where d.opportunity_id = o.id
			group by d.status
		) status_counts on true
		group by o.id, o.title, o.source, o.source_platform, o.deadline, o.created_at
		order by o.created_at desc
	`));
}

async function updateCandidates(
	execute: (query: SQL) => Promise<{ rows?: unknown[] }>
): Promise<BackfillCandidate[]> {
	return rowsOf<BackfillCandidate>(await execute(sql`
		with candidate_ids as (
			select o.id
			from opportunities o
			where (
				o.source = 'source-scrape'
				or o.source_platform = 'Configured Source Scrape'
				or o.source_platform is null
			)
				and (
					o.rfp_link ilike '%dgmarket.com/tender/%'
					or o.portal_url ilike '%dgmarket.com/tender/%'
					or o.document_url ilike '%dgmarket.com/tender/%'
					or o.metadata::text ilike '%dgmarket.com/tender/%'
					or exists (
						select 1
						from opportunity_documents d
						where d.opportunity_id = o.id
							and d.source_url ilike '%dgmarket.com/tender/%'
					)
				)
			order by o.created_at desc
			limit ${LIMIT}
		),
		updated as (
			update opportunities o
			set
				source = 'dgmarket',
				source_platform = 'DGMarket',
				tags = (
					select coalesce(jsonb_agg(tag), '[]'::jsonb)
					from (
						select distinct tag
						from jsonb_array_elements_text(
							(case when jsonb_typeof(o.tags) = 'array' then o.tags else '[]'::jsonb end)
							|| '["dgmarket","global-south","global-procurement","source-documents"]'::jsonb
						) as merged(tag)
						order by tag
					) tags
				),
				updated_at = now()
			from candidate_ids c
			where o.id = c.id
			returning
				o.id,
				o.title,
				o.source,
				o.source_platform,
				o.deadline,
				o.created_at
		)
		select
			u.id::text as "id",
			u.title as "title",
			u.source as "source",
			u.source_platform as "sourcePlatform",
			u.deadline::text as "deadline",
			coalesce(
				jsonb_object_agg(coalesce(status_counts.status::text, 'none'), status_counts.count)
					filter (where status_counts.count is not null),
				'{}'::jsonb
			) as "documentStatuses"
		from updated u
		left join lateral (
			select d.status, count(*)::integer as count
			from opportunity_documents d
			where d.opportunity_id = u.id
			group by d.status
		) status_counts on true
		group by u.id, u.title, u.source, u.source_platform, u.deadline, u.created_at
		order by u.created_at desc
	`));
}

async function summarize(
	execute: (query: SQL) => Promise<{ rows?: unknown[] }>
): Promise<BackfillSummary> {
	const [legacyCount, dgmarketCount, documentStatuses] = await Promise.all([
		scalarCount(execute, sql`
			select count(*)::integer as count
			from opportunities o
			where (
				o.source = 'source-scrape'
				or o.source_platform = 'Configured Source Scrape'
				or o.source_platform is null
			)
				and (
					o.rfp_link ilike '%dgmarket.com/tender/%'
					or o.portal_url ilike '%dgmarket.com/tender/%'
					or o.document_url ilike '%dgmarket.com/tender/%'
					or o.metadata::text ilike '%dgmarket.com/tender/%'
					or exists (
						select 1
						from opportunity_documents d
						where d.opportunity_id = o.id
							and d.source_url ilike '%dgmarket.com/tender/%'
					)
				)
		`),
		scalarCount(execute, sql`
			select count(*)::integer as count
			from opportunities
			where source = 'dgmarket'
				or source_platform = 'DGMarket'
		`),
		rowsOf<{ status: string; count: number }>(await execute(sql`
			select d.status::text as status, count(*)::integer as count
			from opportunity_documents d
			join opportunities o on o.id = d.opportunity_id
			where o.source = 'dgmarket'
				or o.source_platform = 'DGMarket'
			group by d.status
			order by d.status
		`)),
	]);

	return {
		legacyDgmarketOpportunities: legacyCount,
		dgmarketOpportunities: dgmarketCount,
		dgmarketDocumentsByStatus: Object.fromEntries(
			documentStatuses.map((row) => [row.status, row.count]),
		),
	};
}

async function scalarCount(
	execute: (query: SQL) => Promise<{ rows?: unknown[] }>,
	query: SQL
): Promise<number> {
	const [row] = rowsOf<{ count: number }>(await execute(query));
	return Number(row?.count ?? 0);
}

function rowsOf<T>(result: { rows?: unknown[] } | unknown[]): T[] {
	if (Array.isArray(result)) return result as T[];
	return (result.rows ?? []) as T[];
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
	proof: BackfillProof,
	disposition: EvidenceRecord["disposition"]
): Promise<void> {
	const rawPath = await writeProofJson(LOG_DIR, "dgmarket-source-identity-backfill.json", proof);
	const after = proof.after;
	const notes = proof.error
		? proof.error
		: [
			`apply:${proof.config.apply}`,
			`candidates:${proof.candidates.length}`,
			`updated:${proof.updated.length}`,
			`legacy_before:${proof.before.legacyDgmarketOpportunities}`,
			`legacy_after:${after?.legacyDgmarketOpportunities ?? "unknown"}`,
			`dgmarket_after:${after?.dgmarketOpportunities ?? "unknown"}`,
		].join(" ");

	await appendEvidenceRecords(
		EVIDENCE_PATH,
		[{
			facility: "rfp-source-document-intake",
			journey: "dgmarket-source-identity-backfill",
			run_id: proof.runId,
			artifact_ids: [rawPath],
			topology_tier: "live-safe",
			verification_bucket: "live Global South RFP source targeting",
			timestamp: new Date().toISOString(),
			operator: "codex",
			cleanup_status: "not-applicable",
			disposition,
			notes,
		}],
		{ title: "Source Document Intake Evidence" },
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
