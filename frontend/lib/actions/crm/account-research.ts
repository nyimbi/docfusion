"use server";

/**
 * Account Research Actions
 *
 * Server actions for researching accounts using web search.
 * Gathers information from multiple sources to enrich account data.
 */

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema-crm";
import { eq } from "drizzle-orm";

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

// ============================================================================
// Research Functions
// ============================================================================

/**
 * Build search queries for different research categories
 */
function buildSearchQueries(
	companyName: string,
	website: string | null | undefined,
	country: string | null | undefined,
	categories: ResearchCategory[]
): Map<ResearchCategory, string> {
	const queries = new Map<ResearchCategory, string>();
	const locationContext = country ? ` ${country}` : "";
	const websiteContext = website ? ` site:${website.replace(/^https?:\/\//, "")}` : "";

	for (const category of categories) {
		switch (category) {
			case "company_info":
				queries.set(
					category,
					`"${companyName}"${locationContext} company profile about overview`
				);
				break;
			case "contacts":
				queries.set(
					category,
					`"${companyName}"${locationContext} contact email phone address`
				);
				break;
			case "management":
				queries.set(
					category,
					`"${companyName}"${locationContext} CEO founder leadership team executives management`
				);
				break;
			case "clients":
				queries.set(
					category,
					`"${companyName}"${locationContext} clients customers case studies portfolio projects`
				);
				break;
			case "linkedin":
				queries.set(category, `site:linkedin.com/company "${companyName}"`);
				break;
			case "twitter":
				queries.set(
					category,
					`site:twitter.com OR site:x.com "${companyName}"${locationContext}`
				);
				break;
			case "news":
				queries.set(
					category,
					`"${companyName}"${locationContext} news announcement press release 2024 2025 2026`
				);
				break;
			case "general":
				queries.set(category, `"${companyName}"${locationContext}`);
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
		console.error("Error researching account:", error);
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
 */
export async function saveResearchFindings(
	accountId: string,
	updates: Partial<AccountUpdateSuggestion>
): Promise<{ success: boolean; error?: string }> {
	try {
		const updateData: Record<string, string | null> = {};

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
		console.error("Error saving research findings:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to save findings",
		};
	}
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
		console.error("Error getting research queries:", error);
		return {
			success: false,
			queries: [],
			error: error instanceof Error ? error.message : "Failed to get queries",
		};
	}
}
