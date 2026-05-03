import "./load-env";
import { Pool } from "pg";

const REQUIRED_TABLES = [
	"workflow_instances",
	"workflow_runtime_tasks",
	"workflow_audit_events",
	"workflow_notifications",
	"workflow_templates",
];

const REQUIRED_COLUMNS: Record<string, string[]> = {
	workflow_instances: [
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
};

async function main() {
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

		if (missing.length > 0) {
			console.error(JSON.stringify({ ok: false, missing }, null, 2));
			process.exit(1);
		}

		console.log(JSON.stringify({ ok: true, tables: REQUIRED_TABLES }, null, 2));
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
