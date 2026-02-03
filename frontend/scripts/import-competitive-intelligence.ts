/**
 * Import Competitive Intelligence Data
 *
 * This script imports 300 East African software companies from the
 * competitive intelligence Excel file into the competitors table.
 *
 * Usage: npx tsx scripts/import-competitive-intelligence.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { competitors } from "../lib/db/schema-competitors";
import { or, eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

// Database connection
const connectionString = process.env.DATABASE_URL ||
	"postgresql://azureuser:Abcd1234.@lindela16.postgres.database.azure.com:5432/docfusion?sslmode=require";

const pool = new Pool({
	connectionString,
	max: 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 10000,
});

const db = drizzle(pool);

// Path to the JSON data file
const dataPath = path.join(
	__dirname,
	"../../data/Competition/ci_import_data.json"
);

interface CompetitorData {
	id: number;
	name: string;
	country: string;
	city: string | null;
	foundedYear: number | null;
	companyAge: number | null;
	companyType: string | null;
	primaryBusiness: string | null;
	specialization: string | null;
	website: string | null;
	linkedIn: string | null;
	email: string | null;
	phone: string | null;
	physicalAddress: string | null;
	ceoFounder: string | null;
	ctoTechLead: string | null;
	keyManagement: string[] | null;
	managementLinkedin: string[] | null;
	teamSize: string | null;
	engineerCount: string | null;
	keyEngineers: string[] | null;
	notableAlumni: string[] | null;
	annualRevenue: string | null;
	revenueRange: string | null;
	fundingRaised: string | null;
	investors: string[] | null;
	productsServices: string | null;
	technologyStack: string[] | null;
	industriesServed: string[] | null;
	notableClients: string[] | null;
	recentContracts: string | null;
	contractValues: string | null;
	pursuingOpportunities: string | null;
	partnerships: string[] | null;
	certifications: string[] | null;
	awards: string[] | null;
	newsMentions: string[] | null;
	recentNews: string | null;
	socialMediaPresence: string | null;
	competitivePositioning: string | null;
	strengths: string[] | null;
	weaknesses: string[] | null;
	marketShare: string | null;
	growthTrajectory: string | null;
	threatLevel: string | null;
	strategicNotes: string | null;
	lastUpdated: string | null;
}

async function importCompetitor(data: CompetitorData): Promise<{
	action: "created" | "updated" | "skipped";
	name: string;
}> {
	const externalId = String(data.id);

	// Check if competitor already exists
	const existing = await db
		.select({ id: competitors.id })
		.from(competitors)
		.where(
			or(
				eq(competitors.externalId, externalId),
				eq(competitors.name, data.name)
			)
		)
		.limit(1);

	const competitorValues = {
		name: data.name,
		country: data.country,
		city: data.city,
		foundedYear: data.foundedYear,
		companyAge: data.companyAge,
		companyType: data.companyType,
		primaryBusiness: data.primaryBusiness,
		specialization: data.specialization,
		website: data.website,
		linkedIn: data.linkedIn,
		email: data.email,
		phone: data.phone,
		physicalAddress: data.physicalAddress,
		ceoFounder: data.ceoFounder,
		ctoTechLead: data.ctoTechLead,
		keyManagement: data.keyManagement,
		managementLinkedin: data.managementLinkedin,
		teamSize: data.teamSize,
		engineerCount: data.engineerCount,
		keyEngineers: data.keyEngineers,
		notableAlumni: data.notableAlumni,
		annualRevenue: data.annualRevenue,
		revenueRange: data.revenueRange,
		fundingRaised: data.fundingRaised,
		investors: data.investors,
		productsServices: data.productsServices,
		technologyStack: data.technologyStack,
		industriesServed: data.industriesServed,
		notableClients: data.notableClients,
		recentContracts: data.recentContracts,
		contractValues: data.contractValues,
		pursuingOpportunities: data.pursuingOpportunities,
		partnerships: data.partnerships,
		certifications: data.certifications,
		awards: data.awards,
		newsMentions: data.newsMentions,
		recentNews: data.recentNews,
		competitivePositioning: data.competitivePositioning,
		strengths: data.strengths,
		weaknesses: data.weaknesses,
		marketShare: data.marketShare,
		growthTrajectory: data.growthTrajectory,
		threatLevel: data.threatLevel,
		strategicNotes: data.strategicNotes,
		lastUpdated: data.lastUpdated,
		externalId,
		dataSource: "East Africa CI Database 2026",
		intelligenceQuality: "verified" as const,
		updatedAt: new Date(),
	};

	if (existing.length > 0) {
		await db
			.update(competitors)
			.set(competitorValues)
			.where(eq(competitors.id, existing[0].id));
		return { action: "updated", name: data.name };
	} else {
		await db.insert(competitors).values({
			...competitorValues,
			createdAt: new Date(),
		});
		return { action: "created", name: data.name };
	}
}

async function main() {
	console.log("==============================================");
	console.log("Competitive Intelligence Data Import");
	console.log("==============================================\n");

	// Check if data file exists
	if (!fs.existsSync(dataPath)) {
		console.error(`Data file not found: ${dataPath}`);
		console.log(
			"Please run the Excel extraction script first to generate ci_import_data.json"
		);
		process.exit(1);
	}

	// Read and parse the data
	const rawData = fs.readFileSync(dataPath, "utf-8");
	const companies: CompetitorData[] = JSON.parse(rawData);

	console.log(`Found ${companies.length} companies to import\n`);

	// Track statistics
	const stats = {
		created: 0,
		updated: 0,
		failed: 0,
		errors: [] as string[],
	};

	// Process each company
	let count = 0;
	for (const company of companies) {
		count++;
		process.stdout.write(`\rProcessing ${count}/${companies.length}...`);

		try {
			const result = await importCompetitor(company);
			if (result.action === "created") {
				stats.created++;
			} else if (result.action === "updated") {
				stats.updated++;
			}
		} catch (error) {
			stats.failed++;
			stats.errors.push(`${company.name}: ${String(error)}`);
		}
	}

	console.log("\n\n==============================================");
	console.log("Import Complete!");
	console.log("==============================================\n");
	console.log(`Created: ${stats.created}`);
	console.log(`Updated: ${stats.updated}`);
	console.log(`Failed: ${stats.failed}`);

	if (stats.errors.length > 0) {
		console.log("\nErrors:");
		stats.errors.forEach((e) => console.log(`  - ${e}`));
	}

	// Summary by country
	console.log("\nCompanies by Country:");
	const byCountry: Record<string, number> = {};
	companies.forEach((c) => {
		byCountry[c.country] = (byCountry[c.country] || 0) + 1;
	});
	Object.entries(byCountry)
		.sort((a, b) => b[1] - a[1])
		.forEach(([country, count]) => {
			console.log(`  ${country}: ${count}`);
		});

	// Close database connection
	await pool.end();
}

main().catch((error) => {
	console.error("Import failed:", error);
	process.exit(1);
});
