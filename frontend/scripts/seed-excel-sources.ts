/**
 * Seed Scraper Sources from Excel Database
 *
 * Imports tender sources from Tender_Intelligence_Database.xlsx
 * Run with: npx tsx scripts/seed-excel-sources.ts
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import { db } from '../lib/db';
import { scraperSources, type NewScraperSource } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

// ============================================================================
// Type Mappings
// ============================================================================

const entityTypeToSourceType: Record<string, NewScraperSource['sourceType']> = {
	'National Government': 'government',
	'Sub-national Government': 'government',
	'Federal Agency': 'government',
	'State-Owned Enterprise': 'commercial',
	'Government-Linked Company': 'commercial',
	'Government-Owned Corporation': 'commercial',
	'Regulatory Agency': 'government',
	'Sovereign Wealth Fund': 'commercial',
	'Development Authority': 'bilateral',
	'Special Economic Zone': 'government',
	'Social Insurance': 'government',
	'State Broadcaster': 'commercial',
	'Autonomous Authority': 'government',
	'Central Bank': 'government',
	'Statistical Agency': 'government',
	'Tourism Authority': 'government',
	'NGO': 'ngo',
	'Independent Commission': 'government',
	'Utility': 'commercial',
	'Port Authority': 'government',
	'Airport Authority': 'government',
	'University': 'ngo',
	'National Oil Company': 'commercial',
	'Hospital': 'ngo',
	'International Organization': 'un_agency',
};

const countryToCode: Record<string, string> = {
	'Indonesia': 'id',
	'Mexico': 'mx',
	'Tanzania': 'tz',
	'Ghana': 'gh',
	'Pakistan': 'pk',
	'Philippines': 'ph',
	'Vietnam': 'vn',
	'Nigeria': 'ng',
	'South Africa': 'za',
	'Thailand': 'th',
	'Colombia': 'co',
	'Bangladesh': 'bd',
	'Malaysia': 'my',
	'Peru': 'pe',
	'Kenya': 'ke',
	'Chile': 'cl',
	'Argentina': 'ar',
	'Ethiopia': 'et',
	'Sri Lanka': 'lk',
	'Morocco': 'ma',
	'Ecuador': 'ec',
	'Uganda': 'ug',
	'Costa Rica': 'cr',
	'Paraguay': 'py',
	'Zambia': 'zm',
	'Brazil': 'br',
	'India': 'in',
	'Bolivia': 'bo',
	'Guatemala': 'gt',
	'Honduras': 'hn',
	'UAE': 'ae',
	'United Arab Emirates': 'ae',
	'Saudi Arabia': 'sa',
	'Egypt': 'eg',
	'Zimbabwe': 'zw',
	'Rwanda': 'rw',
	'Senegal': 'sn',
	'Ivory Coast': 'ci',
	'Cameroon': 'cm',
	'Mozambique': 'mz',
	'Namibia': 'na',
	'Botswana': 'bw',
	'Mauritius': 'mu',
	'Djibouti': 'dj',
};

function generateSourceId(name: string, country: string): string {
	const countryCode = countryToCode[country] || country.toLowerCase().substring(0, 2);
	const sanitized = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.substring(0, 30);
	return `${countryCode}_${sanitized}`;
}

function mapSourceType(entityType: string | undefined): NewScraperSource['sourceType'] {
	if (!entityType) return 'government';
	return entityTypeToSourceType[entityType] || 'government';
}

// ============================================================================
// Main Import Function
// ============================================================================

async function seedExcelSources() {
	console.log('🌱 Importing tender sources from Excel database...\n');

	// Path to Excel file
	const excelPath = path.resolve(
		process.cwd(),
		'../data/TenderScraping/Tender_Intelligence_Database.xlsx'
	);

	const workbook = XLSX.readFile(excelPath);
	const sheet = workbook.Sheets['Tender Sources'];
	const data = XLSX.utils.sheet_to_json(sheet) as any[];

	// Filter valid sources
	const validSources = data.filter(row =>
		row['Source Name'] && row['URL'] &&
		String(row['Source Name']).trim() !== '' &&
		String(row['URL']).trim() !== ''
	);

	console.log(`📋 Found ${validSources.length} valid sources in Excel\n`);

	// Get existing source IDs to avoid duplicates
	const existing = await db.select({ sourceId: scraperSources.sourceId }).from(scraperSources);
	const existingIds = new Set(existing.map(e => e.sourceId));
	console.log(`📦 ${existingIds.size} sources already in database\n`);

	let successCount = 0;
	let skipCount = 0;
	let errorCount = 0;
	const seenIds = new Set<string>();

	for (const row of validSources) {
		const name = String(row['Source Name']).trim();
		const url = String(row['URL']).trim();
		const country = row['Country Name'] || 'Unknown';
		const region = row['Region'] || null;
		const entityType = row['Entity Type'];
		const language = row['Language'] || 'en';
		const notes = row['Technical Notes'] || null;

		// Generate unique source ID
		let sourceId = generateSourceId(name, country);

		// Handle duplicates within this import
		if (seenIds.has(sourceId) || existingIds.has(sourceId)) {
			skipCount++;
			continue;
		}
		seenIds.add(sourceId);

		try {
			const sourceData: Omit<NewScraperSource, 'id' | 'createdAt' | 'updatedAt'> = {
				sourceId,
				name,
				url,
				sourceType: mapSourceType(entityType),
				coverage: [country.toLowerCase()],
				language: language.toLowerCase().substring(0, 2) as string,
				scraperClass: null, // No scraper class yet
				rateLimit: 1.0,
				timeout: 30,
				maxPages: 10,
				maxRetries: 3,
				requiresJavascript: false,
				requiresAuth: row['Registration Required'] === 'Yes',
				scheduleTier: 3, // Standard daily schedule
				priority: 3, // Lower priority than YAML sources
				enabled: false, // Disabled by default until scrapers are written
				notes: notes ? `${entityType || 'Unknown type'}. ${notes}` : (entityType || 'Unknown entity type'),
				healthStatus: 'unknown',
			};

			await db
				.insert(scraperSources)
				.values(sourceData)
				.onConflictDoNothing();

			const countryCode = countryToCode[country] || '??';
			const typeLabel = (sourceData.sourceType || 'unknown').substring(0, 10).padEnd(10);
			console.log(`  ✓ [${countryCode.toUpperCase()}] ${typeLabel} ${name.substring(0, 40)}`);
			successCount++;
		} catch (error) {
			console.error(`  ✗ ${name}: ${error}`);
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

	console.log(`\nDatabase total: ${totalCount} sources`);

	process.exit(errorCount > 0 ? 1 : 0);
}

// Execute
seedExcelSources().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
