/**
 * Competitive Intelligence Import API
 *
 * POST endpoint to import competitive intelligence data from the Excel file.
 * This imports 300 East African software companies with 47 fields each.
 */

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import {
	bulkImportCompetitiveIntelligence,
	type CompetitiveIntelligenceRow,
} from "@/lib/actions/competitive";

// Default path to the competitive intelligence Excel file
const DEFAULT_CI_FILE_PATH = "/Users/nyimbiodero/src/pjs/docfusion/data/Competition/East_Africa_Software_Companies_Competitive_Intelligence.xlsx";

/**
 * Map Excel row to CompetitiveIntelligenceRow interface.
 * Headers from the Excel file:
 * ID, Company Name, Country, City, Founded Year, Company Age, Company Type, Primary Business,
 * Specialization, Website, LinkedIn, Email, Phone, Physical Address, CEO/Founder, CTO/Tech Lead,
 * Key Management, Management LinkedIn, Team Size, Engineer Count, Key Engineers, Notable Alumni,
 * Annual Revenue (Est.), Revenue Range, Funding Raised, Investors, Products/Services, Technology Stack,
 * Industries Served, Notable Clients, Recent Contracts, Contract Values, Pursuing Opportunities,
 * Partnerships, Certifications, Awards, News Mentions, Recent News, Social Media Presence,
 * Competitive Positioning, Strengths, Weaknesses, Market Share, Growth Trajectory,
 * Threat Level to Datacraft, Strategic Notes, Last Updated
 */
function mapExcelRowToCI(row: unknown[]): CompetitiveIntelligenceRow | null {
	if (!row || !row[0] || !row[1]) return null; // Skip rows without ID or Company Name

	// Handle potential undefined/null values
	const getString = (val: unknown): string | null => {
		if (val === undefined || val === null || val === "") return null;
		return String(val);
	};

	const getNumber = (val: unknown): number | null => {
		if (val === undefined || val === null || val === "") return null;
		const num = Number(val);
		return isNaN(num) ? null : num;
	};

	return {
		id: Number(row[0]) || 0,
		companyName: String(row[1]),
		country: getString(row[2]) || "Unknown",
		city: getString(row[3]) || "",
		foundedYear: getNumber(row[4]),
		companyAge: getNumber(row[5]),
		companyType: getString(row[6]),
		primaryBusiness: getString(row[7]),
		specialization: getString(row[8]),
		website: getString(row[9]),
		linkedIn: getString(row[10]),
		email: getString(row[11]),
		phone: getString(row[12]),
		physicalAddress: getString(row[13]),
		ceoFounder: getString(row[14]),
		ctoTechLead: getString(row[15]),
		keyManagement: getString(row[16]),
		managementLinkedin: getString(row[17]),
		teamSize: getString(row[18]),
		engineerCount: getString(row[19]),
		keyEngineers: getString(row[20]),
		notableAlumni: getString(row[21]),
		annualRevenue: getString(row[22]),
		revenueRange: getString(row[23]),
		fundingRaised: getString(row[24]),
		investors: getString(row[25]),
		productsServices: getString(row[26]),
		technologyStack: getString(row[27]),
		industriesServed: getString(row[28]),
		notableClients: getString(row[29]),
		recentContracts: getString(row[30]),
		contractValues: getString(row[31]),
		pursuingOpportunities: getString(row[32]),
		partnerships: getString(row[33]),
		certifications: getString(row[34]),
		awards: getString(row[35]),
		newsMentions: getString(row[36]),
		recentNews: getString(row[37]),
		socialMediaPresence: getString(row[38]),
		competitivePositioning: getString(row[39]),
		strengths: getString(row[40]),
		weaknesses: getString(row[41]),
		marketShare: getString(row[42]),
		growthTrajectory: getString(row[43]),
		threatLevel: getString(row[44]),
		strategicNotes: getString(row[45]),
		lastUpdated: getString(row[46]),
	};
}

export async function POST(request: NextRequest) {
	try {
		// Check for custom file path in request body
		let filePath = DEFAULT_CI_FILE_PATH;
		try {
			const body = await request.json();
			if (body.filePath) {
				filePath = body.filePath;
			}
		} catch {
			// No body or invalid JSON, use default path
		}

		// Check if file exists
		if (!existsSync(filePath)) {
			return NextResponse.json(
				{ error: `File not found: ${filePath}` },
				{ status: 404 }
			);
		}

		// Read the Excel file
		const fileBuffer = await readFile(filePath);
		const workbook = XLSX.read(fileBuffer, { type: "buffer" });

		// Get the main sheet (first sheet contains all companies)
		const sheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[sheetName];
		const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

		// Skip header row, map remaining rows
		const rows: CompetitiveIntelligenceRow[] = [];
		for (let i = 1; i < data.length; i++) {
			const mapped = mapExcelRowToCI(data[i]);
			if (mapped) {
				rows.push(mapped);
			}
		}

		if (rows.length === 0) {
			return NextResponse.json(
				{ error: "No valid data rows found in Excel file" },
				{ status: 400 }
			);
		}

		// Import the data
		const result = await bulkImportCompetitiveIntelligence(rows);

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			message: `Successfully processed ${result.data.total} companies`,
			data: result.data,
		});
	} catch (error) {
		console.error("[POST /api/import/competitive-intelligence]", error);
		return NextResponse.json(
			{ error: `Import failed: ${String(error)}` },
			{ status: 500 }
		);
	}
}

export async function GET() {
	// Return info about the import endpoint
	return NextResponse.json({
		endpoint: "/api/import/competitive-intelligence",
		method: "POST",
		description: "Import competitive intelligence data from Excel file",
		defaultFile: DEFAULT_CI_FILE_PATH,
		body: {
			filePath: "(optional) Custom path to Excel file",
		},
		expectedFields: 47,
		countries: ["Kenya", "Tanzania", "Uganda", "Rwanda"],
		totalCompanies: 300,
	});
}
