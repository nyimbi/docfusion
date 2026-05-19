"use server";

/**
 * Account Research Actions
 *
 * Server actions for researching accounts using web search.
 * Gathers information from multiple sources to enrich account data.
 */

import { db } from "@/lib/db";
import { accounts, type CommercialInsights } from "@/lib/db/schema-crm";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";
import { requireUserContext } from "@/lib/auth-utils";

// ============================================================================
// Types
// ============================================================================

export type ResearchCategory =
	| "company_info"
	| "contacts"
	| "management"
	| "clients"
	| "linkedin"
	| "twitter"
	| "news"
	| "general";

export interface ResearchRequest {
	accountId: string;
	categories: ResearchCategory[];
	companyName: string;
	website?: string | null;
	country?: string | null;
}

export interface ResearchResult {
	category: ResearchCategory;
	title: string;
	results: ResearchItem[];
	searchQuery: string;
	timestamp: Date;
}

export interface ResearchItem {
	title: string;
	snippet: string;
	url?: string;
	source?: string;
	relevanceScore?: number;
	extractedData?: Record<string, string | string[]>;
}

export interface AccountResearchResponse {
	success: boolean;
	accountId: string;
	accountName: string;
	results: ResearchResult[];
	summary?: string;
	suggestedUpdates?: Partial<AccountUpdateSuggestion>;
	error?: string;
}

export interface AccountUpdateSuggestion {
	website: string;
	email: string;
	phone: string;
	keyLeadership: string;
	description: string;
	linkedinUrl: string;
	industry: string;
	employeeCount: string;
	headquarters: string;
	notableClients: string;
}

export interface ResearchFindingsData {
	summary: string;
	keyInsights: string[];
	opportunities: string[];
	risks: string[];
	nextSteps: string[];
	confidenceScore: number;
}

// ============================================================================
// Research Functions
// ============================================================================

async function requireResearchActor(): Promise<string> {
	return (await requireUserContext()).userId;
}

/**
 * Build search queries for different research categories
 * Note: Avoid quotes in queries as they reduce result count with Firecrawl
 */
function buildSearchQueries(
	companyName: string,
	website: string | null | undefined,
	country: string | null | undefined,
	categories: ResearchCategory[]
): Map<ResearchCategory, string> {
	const queries = new Map<ResearchCategory, string>();
	const locationContext = country ? ` ${country}` : "";

	for (const category of categories) {
		switch (category) {
			case "company_info":
				queries.set(
					category,
					`${companyName}${locationContext} company profile about overview`
				);
				break;
			case "contacts":
				queries.set(
					category,
					`${companyName}${locationContext} contact email phone address`
				);
				break;
			case "management":
				queries.set(
					category,
					`${companyName}${locationContext} CEO founder leadership team executives`
				);
				break;
			case "clients":
				queries.set(
					category,
					`${companyName}${locationContext} clients customers case studies portfolio`
				);
				break;
			case "linkedin":
				queries.set(category, `site:linkedin.com/company ${companyName}`);
				break;
			case "twitter":
				queries.set(
					category,
					`site:twitter.com ${companyName}${locationContext}`
				);
				break;
			case "news":
				queries.set(
					category,
					`${companyName}${locationContext} news announcement press release 2025 2026`
				);
				break;
			case "general":
				queries.set(category, `${companyName}${locationContext}`);
				break;
		}
	}

	return queries;
}

/**
 * Get category display title
 */
function getCategoryTitle(category: ResearchCategory): string {
	const titles: Record<ResearchCategory, string> = {
		company_info: "Company Information",
		contacts: "Contact Information",
		management: "Management & Leadership",
		clients: "Clients & Projects",
		linkedin: "LinkedIn Profile",
		twitter: "Twitter/X & Social Media",
		news: "Recent News",
		general: "General Information",
	};
	return titles[category];
}

/**
 * Research an account using web search
 *
 * This action performs web searches across multiple categories to gather
 * information about an account. Results are structured and can be used
 * to suggest updates to the account record.
 */
export async function researchAccount(
	request: ResearchRequest
): Promise<AccountResearchResponse> {
	await requireResearchActor();

	try {
		// Validate account exists
		const account = await db.query.accounts.findFirst({
			where: eq(accounts.id, request.accountId),
		});

		if (!account) {
			return {
				success: false,
				accountId: request.accountId,
				accountName: request.companyName,
				results: [],
				error: "Account not found",
			};
		}

		// Build search queries for each category
		const queries = buildSearchQueries(
			request.companyName,
			request.website,
			request.country,
			request.categories
		);

		// For now, return structured results that will be populated by the client
		// The actual web search will be performed by the client using WebSearch tool
		const results: ResearchResult[] = [];

		for (const [category, query] of queries.entries()) {
			results.push({
				category,
				title: getCategoryTitle(category),
				results: [],
				searchQuery: query,
				timestamp: new Date(),
			});
		}

		return {
			success: true,
			accountId: request.accountId,
			accountName: account.name,
			results,
		};
	} catch (error) {
		logger.error("Error researching account:", error);
		return {
			success: false,
			accountId: request.accountId,
			accountName: request.companyName,
			results: [],
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Save research findings to an account
 *
 * @param accountId - The account ID to save to
 * @param updates - Basic field updates (website, email, etc.)
 * @param findings - AI-generated research findings
 * @param sources - URLs of sources used
 * @param commercialInsights - Structured commercial opportunities and partnerships
 * @param valueProposition - AI-generated value proposition
 * @param thinkingTrace - AI reasoning trace for human review
 */
export async function saveResearchFindings(
	accountId: string,
	updates: Partial<AccountUpdateSuggestion>,
	findings?: ResearchFindingsData | null,
	sources?: string[],
	commercialInsights?: CommercialInsights | null,
	valueProposition?: string | null,
	thinkingTrace?: string | null
): Promise<{ success: boolean; error?: string }> {
	await requireResearchActor();

	try {
		const updateData: Record<string, unknown> = {};

		// Field updates
		if (updates.website) updateData.website = updates.website;
		if (updates.email) updateData.email = updates.email;
		if (updates.phone) updateData.phone = updates.phone;
		if (updates.keyLeadership) updateData.keyLeadership = updates.keyLeadership;
		if (updates.description) updateData.description = updates.description;
		if (updates.linkedinUrl) updateData.linkedinUrl = updates.linkedinUrl;
		if (updates.industry) updateData.industry = updates.industry;
		if (updates.employeeCount) updateData.employeeCount = updates.employeeCount;
		if (updates.headquarters) updateData.headquarters = updates.headquarters;
		if (updates.notableClients) updateData.notableClients = updates.notableClients;

		// Research findings
		if (findings) {
			// Format findings as readable text
			const findingsText = formatFindingsAsText(findings);
			updateData.researchFindings = findingsText;
			updateData.researchConfidence = findings.confidenceScore;
			updateData.lastResearchDate = new Date();
		}

		// Research sources
		if (sources && sources.length > 0) {
			updateData.researchSources = sources;
		}

		// Commercial insights (structured JSON)
		if (commercialInsights) {
			updateData.commercialInsights = commercialInsights;
		}

		// Value proposition
		if (valueProposition) {
			updateData.valueProposition = valueProposition;
		}

		// AI thinking trace for human review
		if (thinkingTrace) {
			updateData.aiThinkingTrace = thinkingTrace;
		}

		if (Object.keys(updateData).length === 0) {
			return { success: true };
		}

		await db
			.update(accounts)
			.set({
				...updateData,
				updatedAt: new Date(),
			})
			.where(eq(accounts.id, accountId));

		return { success: true };
	} catch (error) {
		logger.error("Error saving research findings:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to save findings",
		};
	}
}

/**
 * Format findings object as readable text
 */
function formatFindingsAsText(findings: ResearchFindingsData): string {
	const sections: string[] = [];

	if (findings.summary) {
		sections.push(`## Summary\n${findings.summary}`);
	}

	if (findings.keyInsights.length > 0) {
		sections.push(`## Key Insights\n${findings.keyInsights.map((i) => `- ${i}`).join("\n")}`);
	}

	if (findings.opportunities.length > 0) {
		sections.push(`## Opportunities\n${findings.opportunities.map((o) => `- ${o}`).join("\n")}`);
	}

	if (findings.risks.length > 0) {
		sections.push(`## Risks & Concerns\n${findings.risks.map((r) => `- ${r}`).join("\n")}`);
	}

	if (findings.nextSteps.length > 0) {
		sections.push(`## Recommended Next Steps\n${findings.nextSteps.map((s) => `- ${s}`).join("\n")}`);
	}

	sections.push(`\n---\nResearch Confidence: ${findings.confidenceScore}%\nGenerated: ${new Date().toLocaleDateString()}`);

	return sections.join("\n\n");
}

/**
 * Get research queries for an account (for client-side execution)
 */
export async function getResearchQueries(
	accountId: string,
	categories: ResearchCategory[]
): Promise<{
	success: boolean;
	queries: Array<{ category: ResearchCategory; query: string; title: string }>;
	error?: string;
}> {
	await requireResearchActor();

	try {
		const account = await db.query.accounts.findFirst({
			where: eq(accounts.id, accountId),
		});

		if (!account) {
			return {
				success: false,
				queries: [],
				error: "Account not found",
			};
		}

		const queryMap = buildSearchQueries(
			account.name,
			account.website,
			account.country,
			categories
		);

		const queries = Array.from(queryMap.entries()).map(([category, query]) => ({
			category,
			query,
			title: getCategoryTitle(category),
		}));

		return {
			success: true,
			queries,
		};
	} catch (error) {
		logger.error("Error getting research queries:", error);
		return {
			success: false,
			queries: [],
			error: error instanceof Error ? error.message : "Failed to get queries",
		};
	}
}
