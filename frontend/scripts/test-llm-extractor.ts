/**
 * Test LLM-Based Tender Extraction
 *
 * Demonstrates that a single schema can extract tenders from ANY site
 * without site-specific parsing code.
 *
 * Usage: npx tsx scripts/test-llm-extractor.ts
 */

import { FirecrawlClient } from "../lib/scrapers/firecrawl";
import { extractTendersWithLLM, TENDER_EXTRACTION_SCHEMA } from "../lib/scrapers/parsers/llm-extractor";

// Create Firecrawl client
const firecrawl = new FirecrawlClient({
	baseUrl: "http://84.247.181.100:3002",
	apiKey: "api-key",
});

// Test sites - diverse formats, no custom parsers needed
const TEST_SITES = [
	{
		name: "COMESA Tenders",
		url: "https://www.comesa.int/tenders/",
		sourceId: "comesa",
	},
	{
		name: "TED Europa Search",
		url: "https://ted.europa.eu/en/search/result",
		sourceId: "ted_europa",
	},
	{
		name: "Relief Web Jobs",
		url: "https://reliefweb.int/jobs?type=4682", // Consultancy type
		sourceId: "reliefweb",
	},
];

async function testLLMExtraction(site: typeof TEST_SITES[0]): Promise<void> {
	console.log(`\n📥 Testing LLM extraction: ${site.name}`);
	console.log(`   URL: ${site.url}`);

	const result = await extractTendersWithLLM(site.url, {
		firecrawl,
		sourceId: site.sourceId,
		sourceName: site.name,
	});

	if (result.error) {
		console.log(`   ❌ Error: ${result.error}`);
		return;
	}

	console.log(`   ✅ Found ${result.opportunities.length} opportunities`);

	if (result.opportunities.length > 0) {
		console.log("\n   Sample extractions:");
		for (const opp of result.opportunities.slice(0, 3)) {
			console.log(`\n   📋 ${opp.title.substring(0, 60)}...`);
			if (opp.organization) console.log(`      Org: ${opp.organization}`);
			if (opp.deadline) console.log(`      Deadline: ${opp.deadline}`);
			if (opp.countryRegion) console.log(`      Country: ${opp.countryRegion}`);
			if (opp.category) console.log(`      Category: ${opp.category}`);
			if (opp.noticeId) console.log(`      ID: ${opp.noticeId}`);
		}
	}

	if (result.nextPageUrl) {
		console.log(`\n   Next page: ${result.nextPageUrl}`);
	}
}

async function main(): Promise<void> {
	console.log("═══════════════════════════════════════════════════════════════");
	console.log("           LLM-BASED TENDER EXTRACTION TEST                     ");
	console.log("═══════════════════════════════════════════════════════════════");
	console.log("\nThis uses a SINGLE schema to extract from ANY tender site.");
	console.log("No site-specific code needed!\n");

	console.log("Schema preview:");
	console.log(JSON.stringify(TENDER_EXTRACTION_SCHEMA.properties.tenders.items.properties, null, 2).substring(0, 500) + "...");

	// Test Firecrawl connection
	console.log("\n🔧 Testing Firecrawl...");
	if (!firecrawl.isConfigured()) {
		console.log("❌ Firecrawl not configured");
		process.exit(1);
	}
	console.log("✅ Firecrawl configured");

	// Test each site
	for (const site of TEST_SITES) {
		await testLLMExtraction(site);
	}

	console.log("\n═══════════════════════════════════════════════════════════════");
	console.log("                      TEST COMPLETE                             ");
	console.log("═══════════════════════════════════════════════════════════════\n");

	console.log("💡 KEY INSIGHT:");
	console.log("   The LLM extractor uses ONE schema for ALL sites.");
	console.log("   No need for 2000 custom parsers - the AI figures it out.");
	console.log("   For anti-bot: add residential proxies to Firecrawl config.");
}

main().catch(console.error);
