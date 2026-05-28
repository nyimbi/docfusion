import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { forceLocalEnv } from "./env-utils";

const MIGRATIONS = [
	"0016_workflow_runtime.sql",
	"0017_workflow_template_governance.sql",
	"0025_workflow_instances_tenant.sql",
];

async function main() {
	forceLocalEnv(["DATABASE_URL"]);
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required to apply workflow runtime migrations");
	}

	const pool = new Pool({
		connectionString: databaseUrl,
		ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
	});

	try {
		for (const filename of MIGRATIONS) {
			const sqlPath = path.resolve(process.cwd(), "drizzle", filename);
			const sql = fs.readFileSync(sqlPath, "utf8");
			await pool.query(sql);
			console.log(JSON.stringify({ migration: filename, applied: true }));
		}
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
