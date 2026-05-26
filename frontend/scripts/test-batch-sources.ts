/**
 * Batch Test: 10 Random Sources from Database
 *
 * Tests LLM extraction across diverse tender sites.
 * Saves results to database and reports summary.
 *
 * Usage: npx tsx scripts/test-batch-sources.ts
 */

import { FirecrawlClient } from "../lib/scrapers/firecrawl";
import { extractTendersWithLLM } from "../lib/scrapers/parsers/llm-extractor";
import { bulkDeduplicateOpportunities } from "../lib/scrapers/deduplicator";

const firecrawl = new FirecrawlClient({
	baseUrl: "http://84.247.181.100:3002",
	apiKey: "api-key",
});

// 10 random sources from database (excluding comesa which we already tested)
const TEST_SOURCES = [
	{ sourceId: "th_cat_telecom", name: "CAT Telecom", url: "https://www.cattelecom.com/procurement" },
	{ sourceId: "afw_gha_0010", name: "Bank of Ghana", url: "https://www.bog.gov.gh" },
	{ sourceId: "mx_imss_instituto_mexicano_del_se", name: "IMSS Mexico", url: "https://compras.imss.gob.mx" },
	{ sourceId: "za_department_of_health", name: "SA Dept of Health", url: "https://www.health.gov.za/tenders" },
	{ sourceId: "gt_municipalidad_de_quetzaltenang", name: "Municipalidad Quetzaltenango", url: "https://www.muniquetzaltenango.gob.gt/contrataciones/" },
	{ sourceId: "lk_airport_aviation_services", name: "Sri Lanka Airport", url: "https://www.airport.lk/tenders" },
	{ sourceId: "asa_ind_0072", name: "Engineers India Ltd", url: "https://www.engineersindia.com/tenders" },
	{ sourceId: "ase_lao_0001", name: "Lao PDR Govt Procurement", url: "https://www.mofrfof.gov.la/procurement" },
	{ sourceId: "int_bil_0001", name: "USAID SAM.gov", url: "https://sam.gov" },
	{ sourceId: "zm_university_teaching_hospital_z", name: "UTH Zambia", url: "https://www.uth.gov.zm/tenders" },
];

interface TestResult {
	sourceId: string;
	name: string;
	url: string;
	status: "success" | "failed" | "no_data";
	extracted: number;
	inserted: number;
	updated: number;
	skipped: number;
	duration: number;
	error?: string;
}

async function testSource(source: typeof TEST_SOURCES[0]): Promise<TestResult> {
	const startTime = Date.now();

	console.log(`\n📥 Testing: ${source.name}`);
	console.log(`   URL: ${source.url}`);

	try {
		// Extract with LLM
		const extractResult = await extractTendersWithLLM(source.url, {
			firecrawl,
			sourceId: source.sourceId,
			sourceName: source.name,
			scrapeOptions: {
				timeout: 120000, // 2 min for scrape
			},
		});

		const duration = (Date.now() - startTime) / 1000;

		if (extractResult.error) {
			console.log(`   ❌ Error: ${extractResult.error.substring(0, 80)}`);
			return {
				...source,
				status: "failed",
				extracted: 0,
				inserted: 0,
				updated: 0,
				skipped: 0,
				duration,
				error: extractResult.error,
			};
		}

		if (extractResult.opportunities.length === 0) {
			console.log(`   ⚠️ No opportunities found`);
			return {
				...source,
				status: "no_data",
				extracted: 0,
				inserted: 0,
				updated: 0,
				skipped: 0,
				duration,
			};
		}

		console.log(`   ✅ Extracted ${extractResult.opportunities.length} opportunities in ${duration.toFixed(1)}s`);

		// Save to database
		const dedupResult = await bulkDeduplicateOpportunities(
			extractResult.opportunities,
			source.sourceId
		);

		const totalDuration = (Date.now() - startTime) / 1000;

		console.log(`   📦 Saved: ${dedupResult.inserted} new, ${dedupResult.updated} updated, ${dedupResult.skipped} skipped`);

		return {
			...source,
			status: "success",
			extracted: extractResult.opportunities.length,
			inserted: dedupResult.inserted,
			updated: dedupResult.updated,
			skipped: dedupResult.skipped,
			duration: totalDuration,
		};

	} catch (error) {
		const duration = (Date.now() - startTime) / 1000;
		const errorMsg = error instanceof Error ? error.message : String(error);
		console.log(`   ❌ Exception: ${errorMsg.substring(0, 80)}`);

		return {
			...source,
			status: "failed",
			extracted: 0,
			inserted: 0,
			updated: 0,
			skipped: 0,
			duration,
			error: errorMsg,
		};
	}
}

async function main(): Promise<void> {
	console.log("═══════════════════════════════════════════════════════════════");
	console.log("         BATCH TEST: 10 RANDOM SCRAPER SOURCES                 ");
	console.log("═══════════════════════════════════════════════════════════════");
	console.log(`\nLLM Model: granite4:350m via Ollama`);
	console.log(`Total sources: ${TEST_SOURCES.length}`);

	const results: TestResult[] = [];
	const overallStart = Date.now();

	// Test each source sequentially (to not overload the LLM)
	for (let i = 0; i < TEST_SOURCES.length; i++) {
		console.log(`\n[${ i + 1}/${TEST_SOURCES.length}]`);
		const result = await testSource(TEST_SOURCES[i]);
		results.push(result);
	}

	const overallDuration = (Date.now() - overallStart) / 1000;

	// Summary
	console.log("\n\n═══════════════════════════════════════════════════════════════");
	console.log("                        RESULTS SUMMARY                         ");
	console.log("═══════════════════════════════════════════════════════════════\n");

	console.log("┌─────────────────────────────┬──────────┬───────────┬──────────┬──────────┬──────────┐");
	console.log("│ Source                      │ Status   │ Extracted │ Inserted │ Skipped  │ Time (s) │");
	console.log("├─────────────────────────────┼──────────┼───────────┼──────────┼──────────┼──────────┤");

	for (const r of results) {
		const name = r.name.substring(0, 27).padEnd(27);
		const status = r.status === "success" ? "✅ OK   " : r.status === "no_data" ? "⚠️ Empty" : "❌ Fail ";
		const extracted = String(r.extracted).padStart(9);
		const inserted = String(r.inserted).padStart(8);
		const skipped = String(r.skipped).padStart(8);
		const duration = r.duration.toFixed(1).padStart(8);
		console.log(`│ ${name} │ ${status} │${extracted} │${inserted} │${skipped} │${duration} │`);
	}

	console.log("└─────────────────────────────┴──────────┴───────────┴──────────┴──────────┴──────────┘");

	// Totals
	const successful = results.filter(r => r.status === "success").length;
	const failed = results.filter(r => r.status === "failed").length;
	const noData = results.filter(r => r.status === "no_data").length;
	const totalExtracted = results.reduce((sum, r) => sum + r.extracted, 0);
	const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);

	console.log(`\n📊 Totals:`);
	console.log(`   Sources tested:     ${results.length}`);
	console.log(`   Successful:         ${successful}`);
	console.log(`   No data:            ${noData}`);
	console.log(`   Failed:             ${failed}`);
	console.log(`   Total extracted:    ${totalExtracted}`);
	console.log(`   Total inserted:     ${totalInserted}`);
	console.log(`   Total time:         ${(overallDuration / 60).toFixed(1)} minutes`);

	// Show failed sources
	const failedResults = results.filter(r => r.status === "failed");
	if (failedResults.length > 0) {
		console.log(`\n❌ Failed sources:`);
		for (const r of failedResults) {
			console.log(`   - ${r.name}: ${r.error?.substring(0, 60)}...`);
		}
	}

	console.log("\n═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
