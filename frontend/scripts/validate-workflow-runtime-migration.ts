import "./load-env";
import { Pool } from "pg";
import { forceLocalEnv } from "./env-utils";

const REQUIRED_TABLES = [
	"workflow_instances",
	"workflow_runtime_tasks",
	"workflow_audit_events",
	"workflow_notifications",
	"workflow_templates",
	"rfp_documents",
	"rfp_parsing_jobs",
	"rfp_requirements",
	"compliance_matrices",
	"compliance_entries",
	"scraper_runs",
	"scraper_sources",
	"opportunities",
];

const REQUIRED_COLUMNS: Record<string, string[]> = {
	workflow_instances: [
		"organization_id",
		"workflow_key",
		"subject_type",
		"subject_id",
		"state",
		"status",
		"assigned_to",
		"sla_breached_at",
		"portal_visibility",
	],
	workflow_runtime_tasks: [
		"workflow_instance_id",
		"task_key",
		"state",
		"assigned_to",
		"assigned_role",
	],
	workflow_audit_events: [
		"workflow_instance_id",
		"event_type",
		"from_state",
		"to_state",
		"actor_id",
		"reason",
	],
	workflow_notifications: [
		"workflow_instance_id",
		"recipient_id",
		"channel",
		"delivery_status",
		"delivered_at",
	],
	workflow_templates: [
		"template_key",
		"name",
		"subject_type",
		"version",
		"status",
		"states",
		"transitions",
		"published_at",
	],
	rfp_documents: [
		"opportunity_id",
		"filename",
		"storage_path",
		"parsing_status",
		"parsing_error",
		"uploaded_by",
	],
	rfp_parsing_jobs: [
		"rfp_document_id",
		"status",
		"current_step",
		"error_message",
		"initiated_by",
	],
	rfp_requirements: [
		"rfp_document_id",
		"opportunity_id",
		"requirement_text",
		"ai_analysis",
		"compliance_status",
	],
	compliance_matrices: [
		"opportunity_id",
		"rfp_document_id",
		"status",
		"total_requirements",
		"created_by",
	],
	compliance_entries: [
		"matrix_id",
		"requirement_id",
		"compliance_status",
		"response_document_id",
		"assigned_to",
	],
	scraper_runs: [
		"source_id",
		"run_id",
		"status",
		"source_key",
		"error_message",
	],
	scraper_sources: [
		"source_id",
		"name",
		"source_type",
		"enabled",
		"health_status",
	],
	opportunities: [
		"title",
		"decision_status",
		"search_vector",
	],
};

const REQUIRED_INDEXES = [
	"opportunities_search_vector_idx",
	"opportunities_title_trgm_idx",
	"opportunities_organization_trgm_idx",
];

const REQUIRED_TRIGGERS = [
	{
		tableName: "opportunities",
		triggerName: "opportunities_search_vector_update",
	},
];

const REQUIRED_FUNCTIONS = [
	"update_opportunity_search_vector",
];

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required to validate workflow runtime migrations");
	}

	const pool = new Pool({
		connectionString: databaseUrl,
		ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
	});

	try {
		const missing: string[] = [];
		for (const tableName of REQUIRED_TABLES) {
			const table = await pool.query(
				"select to_regclass($1) as table_name",
				[`public.${tableName}`]
			);
			if (!table.rows[0]?.table_name) {
				missing.push(`missing table ${tableName}`);
				continue;
			}

			const columns = await pool.query<{ column_name: string }>(
				"select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
				[tableName]
			);
			const presentColumns = new Set(columns.rows.map((row) => row.column_name));
			for (const column of REQUIRED_COLUMNS[tableName] ?? []) {
				if (!presentColumns.has(column)) missing.push(`missing column ${tableName}.${column}`);
			}
		}

		for (const indexName of REQUIRED_INDEXES) {
			const index = await pool.query(
				"select to_regclass($1) as index_name",
				[`public.${indexName}`]
			);
			if (!index.rows[0]?.index_name) missing.push(`missing index ${indexName}`);
		}

		for (const trigger of REQUIRED_TRIGGERS) {
			const result = await pool.query(
				"select 1 from information_schema.triggers where event_object_schema = 'public' and event_object_table = $1 and trigger_name = $2 limit 1",
				[trigger.tableName, trigger.triggerName]
			);
			if (result.rowCount === 0) {
				missing.push(`missing trigger ${trigger.tableName}.${trigger.triggerName}`);
			}
		}

		for (const functionName of REQUIRED_FUNCTIONS) {
			const result = await pool.query(
				"select to_regprocedure($1) as function_name",
				[`${functionName}()`]
			);
			if (!result.rows[0]?.function_name) missing.push(`missing function ${functionName}()`);
		}

		const staleSearchVectors = await pool.query<{ stale_count: string }>(
			`
				select count(*)::text as stale_count
				from public.opportunities
				where search_vector is null
					and (
						title is not null
						or organization is not null
						or project_summary is not null
						or key_requirements is not null
						or country_region is not null
						or category is not null
						or sector is not null
					)
			`
		);
		if (Number(staleSearchVectors.rows[0]?.stale_count ?? 0) > 0) {
			missing.push(`stale opportunity search vectors ${staleSearchVectors.rows[0].stale_count}`);
		}

		if (missing.length > 0) {
			console.error(JSON.stringify({ ok: false, missing }, null, 2));
			process.exit(1);
		}

		console.log(JSON.stringify({
			ok: true,
			tables: REQUIRED_TABLES,
			indexes: REQUIRED_INDEXES,
			triggers: REQUIRED_TRIGGERS.map((trigger) => `${trigger.tableName}.${trigger.triggerName}`),
			functions: REQUIRED_FUNCTIONS.map((functionName) => `${functionName}()`),
			staleSearchVectors: Number(staleSearchVectors.rows[0]?.stale_count ?? 0),
		}, null, 2));
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
