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
const RUN_ID = process.env.GTAI_KFW_SOURCE_IDENTITY_BACKFILL_RUN_ID
	?? createProofRunId("gtai_kfw_source_identity_backfill");
const LOG_DIR = createProofLogDir({
	workspaceRoot: WORKSPACE_ROOT,
	runId: RUN_ID,
	wave: "gtai-kfw-source-identity-backfill",
});
const EVIDENCE_PATH = path.resolve(
	WORKSPACE_ROOT,
	".omx",
	"state",
	"platform-source-document-intake-evidence.md",
);
const APPLY = process.env.GTAI_KFW_SOURCE_IDENTITY_BACKFILL_APPLY === "1";
const LIMIT = boundedNumber(
	process.env.GTAI_KFW_SOURCE_IDENTITY_BACKFILL_LIMIT,
	100,
	1,
	1000,
);

type BackfillCandidate = {
	id: string;
	title: string;
	source: string | null;
	sourcePlatform: string | null;
	rfpLink: string | null;
};

type BackfillSummary = {
	legacyGtaiKfwOpportunities: number;
	gtaiKfwOpportunities: number;
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
					o.rfp_link ilike '%gtai.de/en/trade/%/tenders/%'
					or o.portal_url ilike '%gtai.de/en/trade/%/tenders/%'
					or o.document_url ilike '%gtai.de/en/trade/%/tenders/%'
					or o.metadata::text ilike '%gtai.de/en/meta/search/kfw-tenders%'
				)
			order by o.created_at desc
			limit ${LIMIT}
		)
		select
			o.id::text as "id",
			o.title as "title",
			o.source as "source",
			o.source_platform as "sourcePlatform",
			o.rfp_link as "rfpLink"
		from opportunities o
		join candidate_ids c on c.id = o.id
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
					o.rfp_link ilike '%gtai.de/en/trade/%/tenders/%'
					or o.portal_url ilike '%gtai.de/en/trade/%/tenders/%'
					or o.document_url ilike '%gtai.de/en/trade/%/tenders/%'
					or o.metadata::text ilike '%gtai.de/en/meta/search/kfw-tenders%'
				)
			order by o.created_at desc
			limit ${LIMIT}
		),
		updated as (
			update opportunities o
			set
				source = 'gtai_kfw',
				source_platform = 'GTAI/KfW',
				tags = (
					select coalesce(jsonb_agg(tag), '[]'::jsonb)
					from (
						select distinct tag
						from jsonb_array_elements_text(
							(case when jsonb_typeof(o.tags) = 'array' then o.tags else '[]'::jsonb end)
							|| '["gtai","kfw","development-bank","global-south","source-documents"]'::jsonb
						) as merged(tag)
						order by tag
					) tags
				),
				updated_at = now()
			from candidate_ids c
			where o.id = c.id
			returning o.id, o.title, o.source, o.source_platform, o.rfp_link, o.created_at
		)
		select
			u.id::text as "id",
			u.title as "title",
			u.source as "source",
			u.source_platform as "sourcePlatform",
			u.rfp_link as "rfpLink"
		from updated u
		order by u.created_at desc
	`));
}

async function summarize(
	execute: (query: SQL) => Promise<{ rows?: unknown[] }>
): Promise<BackfillSummary> {
	const [legacyCount, gtaiKfwCount] = await Promise.all([
		scalarCount(execute, sql`
			select count(*)::integer as count
			from opportunities o
			where (
				o.source = 'source-scrape'
				or o.source_platform = 'Configured Source Scrape'
				or o.source_platform is null
			)
				and (
					o.rfp_link ilike '%gtai.de/en/trade/%/tenders/%'
					or o.portal_url ilike '%gtai.de/en/trade/%/tenders/%'
					or o.document_url ilike '%gtai.de/en/trade/%/tenders/%'
					or o.metadata::text ilike '%gtai.de/en/meta/search/kfw-tenders%'
				)
		`),
		scalarCount(execute, sql`
			select count(*)::integer as count
			from opportunities
			where source = 'gtai_kfw'
				or source_platform = 'GTAI/KfW'
		`),
	]);

	return {
		legacyGtaiKfwOpportunities: legacyCount,
		gtaiKfwOpportunities: gtaiKfwCount,
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
	const rawPath = await writeProofJson(LOG_DIR, "gtai-kfw-source-identity-backfill.json", proof);
	const after = proof.after;
	const notes = proof.error
		? proof.error
		: [
			`apply:${proof.config.apply}`,
			`candidates:${proof.candidates.length}`,
			`updated:${proof.updated.length}`,
			`legacy_before:${proof.before.legacyGtaiKfwOpportunities}`,
			`legacy_after:${after?.legacyGtaiKfwOpportunities ?? "unknown"}`,
			`gtai_kfw_after:${after?.gtaiKfwOpportunities ?? "unknown"}`,
		].join(" ");

	await appendEvidenceRecords(
		EVIDENCE_PATH,
		[{
			facility: "rfp-source-document-intake",
			journey: "gtai-kfw-source-identity-backfill",
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
