/**
 * Seed Scraper Sources from YAML Registry
 *
 * Migrates TenderSourceMax sources from YAML to PostgreSQL.
 * Run with: npx tsx scripts/seed-scraper-sources.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { db } from "../lib/db";
import {
	scraperSources,
	scraperSchedules,
	type NewScraperSource,
} from "../lib/db/schema";
import { sql } from "drizzle-orm";

// ============================================================================
// YAML Types
// ============================================================================

interface YamlSource {
	id: string;
	name: string;
	url: string;
	type: string;
	coverage?: string[];
	rate_limit?: number;
	timeout?: number;
	max_pages?: number;
	max_retries?: number;
	javascript?: boolean;
	auth?: boolean;
	priority?: number;
	schedule_tier?: number;
	scraper_class?: string;
	enabled?: boolean;
	notes?: string;
}

interface YamlSchedule {
	cron: string;
	sources: string[];
	max_concurrent?: number;
	timeout_minutes?: number;
}

interface YamlRegistry {
	sources: YamlSource[];
	schedules: Record<string, YamlSchedule>;
	settings?: Record<string, unknown>;
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function seedScraperSources() {
	console.log("🌱 Seeding scraper sources from YAML registry...\n");

	// Path to YAML registry
	const registryPath = path.resolve(
		process.cwd(),
		"../backend/discovery/sources/registry.yaml"
	);

	if (!fs.existsSync(registryPath)) {
		console.error("❌ Registry file not found:", registryPath);
		process.exit(1);
	}

	// Load YAML
	const content = fs.readFileSync(registryPath, "utf-8");
	const registry = yaml.load(content) as YamlRegistry;

	if (!registry?.sources) {
		console.error("❌ No sources found in registry");
		process.exit(1);
	}

	console.log(`📋 Found ${registry.sources.length} sources in registry\n`);

	// ========================================================================
	// Seed Schedule Tiers
	// ========================================================================

	console.log("📅 Seeding schedule tiers...");

	const scheduleTierLabels: Record<string, string> = {
		tier1: "High Priority (6 hours)",
		tier2: "Medium Priority (12 hours)",
		tier3: "Standard (Daily)",
	};

	const scheduleTierDescriptions: Record<string, string> = {
		tier1: "Critical sources scraped every 6 hours - MDBs, UN agencies, major government portals",
		tier2: "Important sources scraped every 12 hours - Regional organizations, medium-priority portals",
		tier3: "Standard sources scraped daily at 06:00 UTC - Lower-priority portals, niche sources",
	};

	if (registry.schedules) {
		for (const [name, schedule] of Object.entries(registry.schedules)) {
			try {
				await db
					.insert(scraperSchedules)
					.values({
						name,
						label: scheduleTierLabels[name] || name,
						cronExpression: schedule.cron,
						description: scheduleTierDescriptions[name] || `Schedule tier ${name}`,
						maxConcurrent: schedule.max_concurrent || 3,
						timeoutMinutes: schedule.timeout_minutes || 30,
						enabled: true,
					})
					.onConflictDoUpdate({
						target: scraperSchedules.name,
						set: {
							cronExpression: sql`EXCLUDED.cron_expression`,
							maxConcurrent: sql`EXCLUDED.max_concurrent`,
							timeoutMinutes: sql`EXCLUDED.timeout_minutes`,
							updatedAt: new Date(),
						},
					});
				console.log(`  ✓ ${name}: ${schedule.cron}`);
			} catch (error) {
				console.error(`  ✗ ${name}: ${error}`);
			}
		}
	}

	// ========================================================================
	// Seed Sources
	// ========================================================================

	console.log("\n📦 Seeding sources...");

	let successCount = 0;
	let errorCount = 0;

	for (const source of registry.sources) {
		try {
			const sourceData: Omit<NewScraperSource, "id" | "createdAt" | "updatedAt"> = {
				sourceId: source.id,
				name: source.name,
				url: source.url,
				sourceType: mapSourceType(source.type),
				coverage: source.coverage || [],
				scraperClass: source.scraper_class || null,
				rateLimit: source.rate_limit || 1.0,
				timeout: source.timeout || 30,
				maxPages: source.max_pages || 10,
				maxRetries: source.max_retries || 3,
				requiresJavascript: source.javascript || false,
				requiresAuth: source.auth || false,
				scheduleTier: source.schedule_tier || 3,
				priority: source.priority || 2,
				enabled: source.enabled !== false,
				notes: source.notes || null,
				healthStatus: "unknown",
			};

			await db
				.insert(scraperSources)
				.values(sourceData)
				.onConflictDoUpdate({
					target: scraperSources.sourceId,
					set: {
						name: sql`EXCLUDED.name`,
						url: sql`EXCLUDED.url`,
						sourceType: sql`EXCLUDED.source_type`,
						coverage: sql`EXCLUDED.coverage`,
						scraperClass: sql`EXCLUDED.scraper_class`,
						rateLimit: sql`EXCLUDED.rate_limit`,
						timeout: sql`EXCLUDED.timeout`,
						maxPages: sql`EXCLUDED.max_pages`,
						maxRetries: sql`EXCLUDED.max_retries`,
						requiresJavascript: sql`EXCLUDED.requires_javascript`,
						requiresAuth: sql`EXCLUDED.requires_auth`,
						scheduleTier: sql`EXCLUDED.schedule_tier`,
						priority: sql`EXCLUDED.priority`,
						notes: sql`EXCLUDED.notes`,
						updatedAt: new Date(),
					},
				});

			const tierLabel = `T${source.schedule_tier || 3}`;
			const typeLabel = source.type.substring(0, 10).padEnd(10);
			console.log(`  ✓ [${tierLabel}] ${typeLabel} ${source.name}`);
			successCount++;
		} catch (error) {
			console.error(`  ✗ ${source.id}: ${error}`);
			errorCount++;
		}
	}

	// ========================================================================
	// Summary
	// ========================================================================

	console.log("\n" + "=".repeat(60));
	console.log("SEED COMPLETE");
	console.log("=".repeat(60));
	console.log(`✓ Sources seeded: ${successCount}`);
	if (errorCount > 0) {
		console.log(`✗ Errors: ${errorCount}`);
	}

	// Verify counts
	const [{ count: sourceCount }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(scraperSources);
	const [{ count: scheduleCount }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(scraperSchedules);

	console.log(`\nDatabase totals:`);
	console.log(`  Sources: ${sourceCount}`);
	console.log(`  Schedules: ${scheduleCount}`);

	process.exit(errorCount > 0 ? 1 : 0);
}

// ============================================================================
// Helpers
// ============================================================================

function mapSourceType(
	yamlType: string
): "mdb" | "un_agency" | "aggregator" | "government" | "regional" | "bilateral" | "ngo" | "commercial" {
	const mapping: Record<string, any> = {
		mdb: "mdb",
		un_agency: "un_agency",
		aggregator: "aggregator",
		government: "government",
		regional: "regional",
		bilateral: "bilateral",
		ngo: "ngo",
		commercial: "commercial",
	};
	return mapping[yamlType] || "aggregator";
}

// ============================================================================
// Execute
// ============================================================================

seedScraperSources().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
