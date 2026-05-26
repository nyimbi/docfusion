/**
 * Scraper End-to-End Test with Database Population
 *
 * Tests the FULL pipeline:
 * 1. Firecrawl with LLM extraction (granite4:350m via Ollama)
 * 2. Deduplication with fingerprinting
 * 3. Database insert/update to opportunities table
 * 4. Verification query
 *
 * Usage: npx tsx scripts/test-scraper-e2e.ts
 */

import { FirecrawlClient } from "../lib/scrapers/firecrawl";
import { extractTendersWithLLM } from "../lib/scrapers/parsers/llm-extractor";
import { bulkDeduplicateOpportunities, type BulkDeduplicationResult } from "../lib/scrapers/deduplicator";
import { db } from "../lib/db";
import { opportunities } from "../lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

// Firecrawl client pointing to the connectivity host.
const firecrawl = new FirecrawlClient({
	baseUrl: "http://84.247.181.100:3002",
	apiKey: "api-key",
});

// Test source
const TEST_SOURCE = {
	name: "COMESA Tenders",
	url: "https://www.comesa.int/tenders/",
	sourceId: "comesa",
};

async function main(): Promise<void> {
	console.log("═══════════════════════════════════════════════════════════════");
	console.log("      SCRAPER END-TO-END TEST (LLM Extraction → Database)      ");
	console.log("═══════════════════════════════════════════════════════════════\n");

	// Step 1: Test Firecrawl + LLM extraction
	console.log("📡 Step 1: Testing Firecrawl + LLM Extraction");
	console.log(`   URL: ${TEST_SOURCE.url}`);
	console.log(`   Model: granite4:350m via Ollama\n`);

	const startTime = Date.now();

	const extractResult = await extractTendersWithLLM(TEST_SOURCE.url, {
		firecrawl,
		sourceId: TEST_SOURCE.sourceId,
		sourceName: TEST_SOURCE.name,
	});

	const extractDuration = ((Date.now() - startTime) / 1000).toFixed(1);

	if (extractResult.error) {
		console.log(`   ❌ Extraction failed: ${extractResult.error}`);
		process.exit(1);
	}

	console.log(`   ✅ Extracted ${extractResult.opportunities.length} opportunities in ${extractDuration}s`);

	if (extractResult.opportunities.length === 0) {
		console.log("\n   ⚠️  No opportunities found. LLM may not have detected tender data.");
		console.log("   Raw extraction:", JSON.stringify(extractResult.rawExtraction, null, 2).substring(0, 500));
		process.exit(0);
	}

	// Show sample
	console.log("\n   Sample extracted opportunities:");
	for (const opp of extractResult.opportunities.slice(0, 3)) {
		console.log(`\n   📋 ${opp.title.substring(0, 70)}${opp.title.length > 70 ? "..." : ""}`);
		if (opp.organization) console.log(`      Org: ${opp.organization}`);
		if (opp.deadline) console.log(`      Deadline: ${opp.deadline}`);
		if (opp.countryRegion) console.log(`      Country: ${opp.countryRegion}`);
		if (opp.category) console.log(`      Category: ${opp.category?.substring(0, 50)}...`);
		if (opp.noticeId) console.log(`      ID: ${opp.noticeId.substring(0, 30)}...`);
	}

	// Step 2: Deduplicate and save to database
	console.log("\n\n📦 Step 2: Deduplicating and Saving to Database");

	const dedupStart = Date.now();
	let dedupResult: BulkDeduplicationResult;

	try {
		dedupResult = await bulkDeduplicateOpportunities(
			extractResult.opportunities,
			TEST_SOURCE.sourceId
		);
	} catch (error) {
		console.log(`   ❌ Database save failed: ${error}`);
		process.exit(1);
	}

	const dedupDuration = ((Date.now() - dedupStart) / 1000).toFixed(1);

	console.log(`   ✅ Processed ${dedupResult.total} opportunities in ${dedupDuration}s`);
	console.log(`\n   Results:`);
	console.log(`   ├─ Inserted (new):    ${dedupResult.inserted}`);
	console.log(`   ├─ Updated (changed): ${dedupResult.updated}`);
	console.log(`   ├─ Skipped (exists):  ${dedupResult.skipped}`);
	console.log(`   └─ Failed:            ${dedupResult.failed}`);

	if (dedupResult.errors.length > 0) {
		console.log(`\n   Errors:`);
		for (const err of dedupResult.errors.slice(0, 3)) {
			console.log(`   - Index ${err.index}: ${err.error}`);
		}
	}

	// Step 3: Verify in database
	console.log("\n\n🔍 Step 3: Verifying Database Records");

	try {
		// Count total opportunities from this source
		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(opportunities)
			.where(eq(opportunities.source, TEST_SOURCE.sourceId));

		const totalCount = countResult[0]?.count || 0;
		console.log(`   Total opportunities from '${TEST_SOURCE.sourceId}': ${totalCount}`);

		// Get recent records
		const recentRecords = await db.query.opportunities.findMany({
			where: eq(opportunities.source, TEST_SOURCE.sourceId),
			orderBy: [desc(opportunities.scrapedAt)],
			limit: 5,
			columns: {
				id: true,
				title: true,
				organization: true,
				deadline: true,
				scrapedAt: true,
				fingerprint: true,
			},
		});

		console.log(`\n   Recent records in database:`);
		for (const record of recentRecords) {
			console.log(`\n   📄 ${record.title.substring(0, 60)}...`);
			console.log(`      ID: ${record.id}`);
			console.log(`      Org: ${record.organization || "N/A"}`);
			console.log(`      Deadline: ${record.deadline || "N/A"}`);
			console.log(`      Scraped: ${record.scrapedAt}`);
			console.log(`      Fingerprint: ${record.fingerprint?.substring(0, 16)}...`);
		}

	} catch (error) {
		console.log(`   ❌ Database query failed: ${error}`);
	}

	// Summary
	console.log("\n\n═══════════════════════════════════════════════════════════════");
	console.log("                       TEST SUMMARY                             ");
	console.log("═══════════════════════════════════════════════════════════════");
	console.log(`\n   Source:          ${TEST_SOURCE.name}`);
	console.log(`   LLM Model:       granite4:350m (Ollama)`);
	console.log(`   Extraction Time: ${extractDuration}s`);
	console.log(`   Dedup Time:      ${dedupDuration}s`);
	console.log(`   Total Time:      ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
	console.log(`\n   Opportunities:   ${extractResult.opportunities.length} extracted`);
	console.log(`                    ${dedupResult.inserted} new inserts`);
	console.log(`                    ${dedupResult.updated} updates`);
	console.log(`                    ${dedupResult.skipped} duplicates skipped`);

	const success = dedupResult.inserted > 0 || dedupResult.updated > 0 || dedupResult.skipped > 0;
	console.log(`\n   Status:          ${success ? "✅ PASSED" : "⚠️ NO DATA SAVED"}`);
	console.log("\n═══════════════════════════════════════════════════════════════\n");

	process.exit(success ? 0 : 1);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
