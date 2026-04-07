/**
 * Database connection for DocFusion.
 *
 * Uses Drizzle ORM with PostgreSQL for type-safe database access.
 * Connection pooling handled by pg Pool.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { logger } from "@/lib/utils/logger";

// Connection string from environment or provided default
const connectionString =
	process.env.DATABASE_URL ||
	"postgresql://azureuser:Abcd1234.@lindela16.postgres.database.azure.com:5432/docfusion?sslmode=require";

// Create connection pool with sensible defaults for serverless
const pool = new Pool({
	connectionString,
	max: 10, // Maximum connections in pool
	idleTimeoutMillis: 30000, // Close idle connections after 30s
	connectionTimeoutMillis: 10000, // Connection timeout 10s
	ssl: { rejectUnauthorized: false }, // Azure requires SSL
});

// Drizzle instance with schema for type inference
export const db = drizzle(pool, { schema });

// Export schema for direct access
export * from "./schema";

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		const client = await pool.connect();
		await client.query("SELECT 1");
		client.release();
		return true;
	} catch (error) {
		logger.error("Database connection failed:", error);
		return false;
	}
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
	await pool.end();
}
