/**
 * Analyze Tender Intelligence Database Excel
 *
 * Reads the Excel file and shows statistics about tender sources.
 */

import * as XLSX from './lib/xlsx-reader';
import * as path from 'path';

const excelPath = path.resolve(
	process.cwd(),
	'../data/TenderScraping/Tender_Intelligence_Database.xlsx'
);

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets['Tender Sources'];
const data = XLSX.utils.sheet_to_json(sheet) as any[];

console.log('Total rows in Excel:', data.length);

// Filter valid sources (have name and URL)
const valid = data.filter(row =>
	row['Source Name'] && row['URL'] &&
	String(row['Source Name']).trim() !== '' &&
	String(row['URL']).trim() !== ''
);

console.log('\nValid sources with Name + URL:', valid.length);

// Show sample
console.log('\nSample valid sources:');
valid.slice(0, 15).forEach((row, i) => {
	console.log(i + 1, {
		name: row['Source Name'],
		url: String(row['URL'] || '').substring(0, 50) + '...',
		country: row['Country Name'],
		type: row['Entity Type'],
		quality: row['Data Quality Score']
	});
});

// Count by country (for valid sources)
const byCountry: Record<string, number> = {};
valid.forEach(row => {
	const country = row['Country Name'] || 'Unknown';
	byCountry[country] = (byCountry[country] || 0) + 1;
});
const topCountries = Object.entries(byCountry)
	.sort((a, b) => b[1] - a[1])
	.slice(0, 25);
console.log('\nTop 25 countries:');
topCountries.forEach(([country, count]) => {
	console.log(`  ${country}: ${count}`);
});

// Count by entity type
const byType: Record<string, number> = {};
valid.forEach(row => {
	const type = row['Entity Type'] || 'Unknown';
	byType[type] = (byType[type] || 0) + 1;
});
console.log('\nBy Entity Type:');
Object.entries(byType)
	.sort((a, b) => b[1] - a[1])
	.forEach(([type, count]) => {
		console.log(`  ${type}: ${count}`);
	});
