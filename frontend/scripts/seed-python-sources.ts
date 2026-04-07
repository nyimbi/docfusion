/**
 * Import Tender Sources from Python-extracted JSON
 *
 * Imports sources from the Python source scripts via all_sources.json
 * Run with: npx tsx scripts/seed-python-sources.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../lib/db';
import { scraperSources, type NewScraperSource } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

// ============================================================================
// Type Mappings
// ============================================================================

const entityTypeToSourceType: Record<string, NewScraperSource['sourceType']> = {
	'National Government Portal': 'government',
	'Federal Ministry': 'government',
	'State/Provincial Government': 'government',
	'Municipal/Local Government': 'government',
	'Infrastructure Authority': 'government',
	'Parastatal/SOE': 'commercial',
	'Public Utility': 'commercial',
	'Central Bank/Regulator': 'government',
	'Electoral Body': 'government',
	'Pension/Social Fund': 'government',
	'University/Research': 'ngo',
	'Hospital/Health System': 'ngo',
	'Development Finance': 'mdb',
	'International Organization': 'un_agency',
	'UN Agency': 'un_agency',
	'Regional Body': 'regional',
	'MDB': 'mdb',
	'Bilateral': 'bilateral',
	'NGO': 'ngo',
};

const regionToScheduleTier: Record<string, number> = {
	'Africa-East': 1,
	'Africa-West': 1,
	'Africa-Southern': 2,
	'Africa-Central': 2,
	'Africa-North': 2,
	'Global': 1,
	'International': 1,
	'Latin-America': 2,
	'Asia-South': 2,
	'Asia-Southeast': 2,
	'Middle-East': 2,
};

function generateSourceId(originalId: string): string {
	// Convert AFE-KEN-0001 format to afe_ken_0001
	return originalId.toLowerCase().replace(/-/g, '_');
}

function mapSourceType(entityType: string | undefined): NewScraperSource['sourceType'] {
	if (!entityType) return 'government';
	return entityTypeToSourceType[entityType] || 'government';
}

function getScheduleTier(region: string): number {
	return regionToScheduleTier[region] || 3;
}

function estimatedTendersToVolume(estimate: string): number {
	if (estimate.includes('Very High')) return 1;
	if (estimate.includes('High')) return 2;
	if (estimate.includes('Medium')) return 3;
	return 4;
}

// ============================================================================
// Main Import Function
// ============================================================================

interface PythonSource {
	Source_ID: string;
	Source_Name: string;
	URL: string;
	Country_Code: string;
	Country_Name: string;
	Region: string;
	Entity_Type: string;
	Entity_Subtype: string;
	Sectors_Covered: string;
	Languages: string;
	Update_Frequency: string;
	Registration_Required: string;
	API_Available: string;
	Data_Format: string;
	Est_Annual_Tenders: string;
	Technical_Notes: string;
	Primary_Source: string;
	Last_Verified: string;
}

async function seedPythonSources() {
	console.log('🌱 Importing tender sources from Python extraction...\n');

	// Path to JSON file
	const jsonPath = path.resolve(
		process.cwd(),
		'../data/TenderScraping/core_sources.json'
	);

	if (!fs.existsSync(jsonPath)) {
		console.error('❌ all_sources.json not found. Run extract_all_sources.py first.');
		process.exit(1);
	}

	const rawData = fs.readFileSync(jsonPath, 'utf-8');
	const sources: PythonSource[] = JSON.parse(rawData);

	console.log(`📋 Found ${sources.length} sources in JSON\n`);

	// Get existing source IDs to avoid duplicates
	const existing = await db.select({ sourceId: scraperSources.sourceId }).from(scraperSources);
	const existingIds = new Set(existing.map(e => e.sourceId));
	console.log(`📦 ${existingIds.size} sources already in database\n`);

	let successCount = 0;
	let skipCount = 0;
	let errorCount = 0;
	const seenIds = new Set<string>();

	for (const source of sources) {
		const sourceId = generateSourceId(source.Source_ID);

		// Skip duplicates
		if (seenIds.has(sourceId) || existingIds.has(sourceId)) {
			skipCount++;
			continue;
		}
		seenIds.add(sourceId);

		try {
			const scheduleTier = getScheduleTier(source.Region);
			const priority = estimatedTendersToVolume(source.Est_Annual_Tenders);

			const sourceData: Omit<NewScraperSource, 'id' | 'createdAt' | 'updatedAt'> = {
				sourceId,
				name: source.Source_Name,
				url: source.URL,
				sourceType: mapSourceType(source.Entity_Type),
				coverage: [source.Country_Name.toLowerCase()],
				language: source.Languages.split(',')[0].trim().toLowerCase().substring(0, 2),
				scraperClass: null, // No scraper yet
				rateLimit: 1.0,
				timeout: 30,
				maxPages: 10,
				maxRetries: 3,
				requiresJavascript: source.Data_Format.includes('JavaScript') || false,
				requiresAuth: source.Registration_Required !== 'No',
				scheduleTier,
				priority,
				enabled: false, // Disabled until scrapers are written
				healthStatus: 'unknown',
				notes: [
					`${source.Entity_Type} - ${source.Entity_Subtype}`,
					source.Sectors_Covered,
					source.Technical_Notes,
					`Update: ${source.Update_Frequency}`,
					source.API_Available === 'Yes' ? 'API available' : null,
				].filter(Boolean).join('. '),
			};

			await db
				.insert(scraperSources)
				.values(sourceData)
				.onConflictDoNothing();

			const regionCode = source.Region.substring(0, 8).padEnd(8);
			const typeLabel = (sourceData.sourceType || 'unknown').substring(0, 10).padEnd(10);
			console.log(`  ✓ [${regionCode}] ${typeLabel} ${source.Source_Name.substring(0, 40)}`);
			successCount++;
		} catch (error) {
			console.error(`  ✗ ${source.Source_Name}: ${error}`);
			errorCount++;
		}

		// Rate limit database writes
		if (successCount % 50 === 0) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	}

	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('IMPORT COMPLETE');
	console.log('='.repeat(60));
	console.log(`✓ Sources imported: ${successCount}`);
	console.log(`○ Skipped (duplicates): ${skipCount}`);
	if (errorCount > 0) {
		console.log(`✗ Errors: ${errorCount}`);
	}

	// Verify counts
	const [{ count: totalCount }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(scraperSources);

	const [{ enabled: enabledCount }] = await db
		.select({ enabled: sql<number>`count(*) filter (where enabled)` })
		.from(scraperSources);

	console.log(`\nDatabase totals:`);
	console.log(`  Total sources: ${totalCount}`);
	console.log(`  Enabled sources: ${enabledCount}`);

	// By region summary
	const byRegion = await db
		.select({
			sourceType: scraperSources.sourceType,
			count: sql<number>`count(*)`,
		})
		.from(scraperSources)
		.groupBy(scraperSources.sourceType);

	console.log(`\nBy source type:`);
	for (const row of byRegion) {
		console.log(`  ${row.sourceType}: ${row.count}`);
	}

	process.exit(errorCount > 0 ? 1 : 0);
}

// Execute
seedPythonSources().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
