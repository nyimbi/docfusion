import "./load-env";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

interface JournalEntry {
	idx: number;
	when: number;
	tag: string;
	breakpoints: boolean;
}

interface RecordResult {
	migration: string;
	hash: string;
	createdAt: number;
	source: "journal" | "mtime";
	dryRun: boolean;
	status: "inserted" | "already-recorded" | "would-insert";
	existingRowsWithHash: number;
}

async function main() {
	const { migrationArg, dryRun } = parseArgs(process.argv.slice(2));
	const migrationPath = resolveMigrationPath(migrationArg);
	const migration = path.basename(migrationPath);
	const query = fs.readFileSync(migrationPath, "utf8");
	const hash = crypto.createHash("sha256").update(query).digest("hex");
	const createdAt = resolveCreatedAt(migrationPath);

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is required to record a Drizzle migration");

	const pool = new Pool({
		connectionString: databaseUrl,
		ssl: { rejectUnauthorized: false },
	});

	try {
		await ensureMigrationTable(pool);
		const existing = await pool.query<{ id: number }>(
			"SELECT id FROM drizzle.__drizzle_migrations WHERE hash = $1 AND created_at = $2 LIMIT 1",
			[hash, createdAt.when]
		);
		const existingHashRows = await pool.query<{ count: string }>(
			"SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations WHERE hash = $1",
			[hash]
		);

		let status: RecordResult["status"] = "already-recorded";
		if (!existing.rowCount) {
			status = dryRun ? "would-insert" : "inserted";
			if (!dryRun) {
				await pool.query(
					"INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
					[hash, createdAt.when]
				);
			}
		}

		const result: RecordResult = {
			migration,
			hash,
			createdAt: createdAt.when,
			source: createdAt.source,
			dryRun,
			status,
			existingRowsWithHash: Number(existingHashRows.rows[0]?.count ?? 0),
		};
		console.log(JSON.stringify(result, null, 2));
	} finally {
		await pool.end();
	}
}

function parseArgs(args: string[]) {
	const dryRun = args.includes("--dry-run");
	const migrationArg = args.find((arg) => !arg.startsWith("--"));
	if (!migrationArg) {
		throw new Error("Usage: npm run db:record-migration -- <migration.sql> [--dry-run]");
	}
	return { migrationArg, dryRun };
}

function resolveMigrationPath(migrationArg: string): string {
	const drizzleDir = path.resolve(process.cwd(), "drizzle");
	const candidate = path.resolve(process.cwd(), migrationArg);
	const fallback = path.resolve(drizzleDir, migrationArg);
	const migrationPath = fs.existsSync(candidate) ? candidate : fallback;
	const relative = path.relative(drizzleDir, migrationPath);

	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(`Migration must be under ${drizzleDir}`);
	}
	if (!migrationPath.endsWith(".sql") || !fs.existsSync(migrationPath)) {
		throw new Error(`Migration file not found: ${migrationArg}`);
	}
	return migrationPath;
}

function resolveCreatedAt(migrationPath: string): { when: number; source: RecordResult["source"] } {
	const tag = path.basename(migrationPath, ".sql");
	const journalPath = path.resolve(path.dirname(migrationPath), "meta", "_journal.json");
	if (fs.existsSync(journalPath)) {
		const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { entries: JournalEntry[] };
		const entry = journal.entries.find((candidate) => candidate.tag === tag);
		if (entry) return { when: entry.when, source: "journal" };
	}

	return {
		when: Math.floor(fs.statSync(migrationPath).mtimeMs),
		source: "mtime",
	};
}

async function ensureMigrationTable(pool: Pool) {
	await pool.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
	await pool.query(`
		CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)
	`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
