/**
 * Scraper End-to-End Test Script
 *
 * Tests the full scraper pipeline:
 * 1. Firecrawl integration OR basic HTTP fetch
 * 2. Parser extraction
 * 3. Deduplication logic
 *
 * Usage: npx tsx scripts/test-scraper.ts
 */

import { FirecrawlClient } from "../lib/scrapers/firecrawl";
import { genericParser } from "../lib/scrapers/parsers/generic";
import { dgmarketParser } from "../lib/scrapers/parsers/dgmarket";
import { generateFingerprint } from "../lib/scrapers/deduplicator";

// Create Firecrawl client with explicit config
const firecrawl = new FirecrawlClient({
	baseUrl: "http://84.247.181.100:3002",
	apiKey: "api-key",
});

// Test URLs for tender sites
const TEST_SOURCES = [
	{
		name: "AfDB Procurement",
		url: "https://www.afdb.org/en/documents/procurement-notices",
		parser: genericParser,
		sourceId: "afdb",
	},
	{
		name: "COMESA Tenders",
		url: "https://www.comesa.int/tenders/",
		parser: genericParser,
		sourceId: "comesa",
	},
	{
		name: "EAC Tenders",
		url: "https://www.eac.int/opportunities/tenders",
		parser: genericParser,
		sourceId: "eac",
	},
];

async function fetchWithBasicHttp(url: string): Promise<{ markdown: string; links: string[] }> {
	console.log("   Using basic HTTP fetch (Firecrawl not configured)...");

	const response = await fetch(url, {
		headers: {
			"User-Agent": "DocuFusion-Scraper/1.0 (+https://docufusion.ai/bot)",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.5",
		},
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const html = await response.text();

	// Extract links from HTML
	const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
	const links: string[] = [];
	let match;
	while ((match = linkPattern.exec(html)) !== null) {
		try {
			const absoluteUrl = new URL(match[1], url).toString();
			links.push(absoluteUrl);
		} catch {
			// Invalid URL, skip
		}
	}

	// Convert HTML to simple markdown-ish text for parsing
	const markdown = html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, "\n")
		.replace(/\s+/g, " ")
		.trim();

	return { markdown, links };
}

async function testFirecrawlConnection(): Promise<boolean> {
	console.log("\n🔧 Testing Firecrawl connection...\n");

	if (!firecrawl.isConfigured()) {
		console.log("⚠️  Firecrawl is NOT configured");
		console.log("   Will use basic HTTP fetch instead");
		console.log("   (Set FIRECRAWL_URL and FIRECRAWL_KEY in .env.local for better results)");
		return false;
	}

	console.log("✅ Firecrawl is configured");

	// Test with example.com
	try {
		const result = await firecrawl.scrape("https://example.com", {
			formats: ["markdown"],
			timeout: 10000,
		});

		if (result.success) {
			console.log("✅ Firecrawl connection working");
			console.log(`   Content length: ${result.data?.markdown?.length || 0} chars`);
			return true;
		} else {
			console.log("⚠️  Firecrawl scrape failed:", result.error);
			console.log("   Will use basic HTTP fetch instead");
			return false;
		}
	} catch (error) {
		console.log("⚠️  Firecrawl error:", error);
		console.log("   Will use basic HTTP fetch instead");
		return false;
	}
}

async function testScraper(
	source: (typeof TEST_SOURCES)[0],
	useFirecrawl: boolean
): Promise<void> {
	console.log(`\n📥 Testing: ${source.name}`);
	console.log(`   URL: ${source.url}`);
	console.log(`   Parser: ${source.parser.sourceId}`);

	try {
		// Step 1: Fetch page
		console.log("\n   [1/3] Fetching page...");

		let markdown: string;
		let links: string[];

		if (useFirecrawl) {
			const scrapeResult = await firecrawl.scrape(source.url, {
				formats: ["markdown", "links"],
				timeout: 30000,
			});

			if (!scrapeResult.success) {
				console.log(`   ❌ Scrape failed: ${scrapeResult.error}`);
				return;
			}

			markdown = scrapeResult.data?.markdown || "";
			links = scrapeResult.data?.links || [];
		} else {
			const result = await fetchWithBasicHttp(source.url);
			markdown = result.markdown;
			links = result.links;
		}

		console.log(`   ✅ Got ${markdown.length} chars content, ${links.length} links`);

		// Step 2: Parse with parser
		console.log("\n   [2/3] Parsing opportunities...");
		const parseResult = await source.parser.parse({
			markdown,
			links,
			url: source.url,
		});

		console.log(`   ✅ Found ${parseResult.opportunities.length} opportunities`);

		if (parseResult.opportunities.length > 0) {
			console.log("\n   Sample opportunities:");
			for (const opp of parseResult.opportunities.slice(0, 3)) {
				console.log(`   - ${opp.title.substring(0, 60)}...`);
				if (opp.organization) console.log(`     Org: ${opp.organization}`);
				if (opp.deadline) console.log(`     Deadline: ${opp.deadline}`);
			}
		}

		// Step 3: Test fingerprint generation
		console.log("\n   [3/3] Testing fingerprint generation...");
		if (parseResult.opportunities.length > 0) {
			const testOpp = parseResult.opportunities[0];
			const fingerprint = generateFingerprint({
				title: testOpp.title,
				organization: testOpp.organization,
				deadline: testOpp.deadline,
			});
			console.log(`   Title: "${testOpp.title.substring(0, 50)}..."`);
			console.log(`   Fingerprint: ${fingerprint.substring(0, 16)}...`);
		}

		console.log(`\n   ✅ ${source.name} test passed!`);
	} catch (error) {
		console.log(`   ❌ Error: ${error}`);
	}
}

async function testParserDirect(): Promise<void> {
	console.log("\n📝 Testing parser with sample markdown...\n");

	const sampleMarkdown = `
# Open Tenders

## Request for Proposal: IT Infrastructure Upgrade
**Organization:** Ministry of Technology
**Deadline:** February 28, 2026
**Budget:** USD 500,000
**Country:** Kenya

The Ministry invites proposals for upgrading IT infrastructure.

## EOI: Consulting Services for Water Project
**Organization:** African Development Bank
**Deadline:** March 15, 2026
**Country:** Tanzania

Expression of Interest for water infrastructure consulting.

## Tender Notice: Construction of Rural Roads
**Organization:** Uganda Roads Authority
**Deadline:** April 1, 2026
**Budget:** UGX 2,000,000,000

Tender for construction of 50km rural road network.
`;

	const result = await genericParser.parse({
		markdown: sampleMarkdown,
		url: "https://example.com/tenders",
	});

	console.log(`Found ${result.opportunities.length} opportunities from sample markdown:`);
	for (const opp of result.opportunities) {
		console.log(`\n- ${opp.title}`);
		console.log(`  Org: ${opp.organization || "N/A"}`);
		console.log(`  Deadline: ${opp.deadline || "N/A"}`);
		console.log(`  Country: ${opp.countryRegion || "N/A"}`);

		const fp = generateFingerprint({
			title: opp.title,
			organization: opp.organization,
			deadline: opp.deadline,
		});
		console.log(`  Fingerprint: ${fp.substring(0, 16)}...`);
	}
}

async function main(): Promise<void> {
	console.log("═══════════════════════════════════════════════════════════════");
	console.log("                 SCRAPER END-TO-END TEST                        ");
	console.log("═══════════════════════════════════════════════════════════════");

	// Test Firecrawl first
	const useFirecrawl = await testFirecrawlConnection();

	// Test parser with controlled input first
	await testParserDirect();

	// Test each real source
	for (const source of TEST_SOURCES) {
		await testScraper(source, useFirecrawl);
	}

	console.log("\n═══════════════════════════════════════════════════════════════");
	console.log("                      TEST COMPLETE                             ");
	console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
