"use server";

/**
 * Contact Research Actions
 *
 * Server actions for researching contacts using web search.
 * Gathers career history, publications, social profiles, and insights.
 */

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema-crm";
import { eq, and } from "drizzle-orm";
import type { UserContext } from "./contacts";

// ============================================================================
// Types
// ============================================================================

export type ContactResearchCategory =
	| "linkedin"
	| "twitter"
	| "publications"
	| "news"
	| "career"
	| "general";

export interface ContactResearchRequest {
	contactId: string;
	fullName: string;
	email?: string | null;
	company?: string | null;
	title?: string | null;
	categories: ContactResearchCategory[];
}

export interface ContactResearchResult {
	category: ContactResearchCategory;
	title: string;
	results: ContactResearchItem[];
	searchQuery: string;
	timestamp: Date;
}

export interface ContactResearchItem {
	title: string;
	snippet: string;
	url?: string;
	source?: string;
	relevanceScore?: number;
	extractedData?: Record<string, string | string[]>;
}

export interface ContactResearchResponse {
	success: boolean;
	contactId: string;
	contactName: string;
	results: ContactResearchResult[];
	summary?: string;
	suggestedUpdates?: Partial<ContactUpdateSuggestion>;
	error?: string;
}

export interface ContactUpdateSuggestion {
	linkedinUrl: string;
	title: string;
	currentProjects: string;
	skills: string[];
	interests: string[];
	careerHistory: Array<{
		company: string;
		title: string;
		startDate?: string;
		endDate?: string;
	}>;
	educationHistory: Array<{
		institution: string;
		degree?: string;
		field?: string;
		year?: number;
	}>;
	publications: string[];
	valueProposition: string;
}

export interface ContactResearchFindings {
	summary: string;
	keyInsights: string[];
	talkingPoints: string[];
	connectionOpportunities: string[];
	confidenceScore: number;
}

// ============================================================================
// Search Query Builders
// ============================================================================

function buildContactSearchQueries(
	fullName: string,
	email: string | null | undefined,
	company: string | null | undefined,
	title: string | null | undefined,
	categories: ContactResearchCategory[]
): Map<ContactResearchCategory, string> {
	const queries = new Map<ContactResearchCategory, string>();
	const companyContext = company ? ` ${company}` : "";
	const titleContext = title ? ` ${title}` : "";

	for (const category of categories) {
		switch (category) {
			case "linkedin":
				queries.set(category, `${fullName}${companyContext} site:linkedin.com/in`);
				break;
			case "twitter":
				queries.set(category, `${fullName}${companyContext} site:twitter.com OR site:x.com`);
				break;
			case "publications":
				queries.set(category, `${fullName}${titleContext} publications articles author`);
				break;
			case "news":
				queries.set(category, `${fullName}${companyContext} news announcement`);
				break;
			case "career":
				queries.set(category, `${fullName}${companyContext} career history experience`);
				break;
			case "general":
				queries.set(category, `${fullName}${companyContext}${titleContext}`);
				break;
		}
	}

	return queries;
}

// ============================================================================
// Main Research Function
// ============================================================================

/**
 * Research a contact using web search across multiple categories.
 */
export async function researchContact(
	request: ContactResearchRequest,
	userContext: UserContext
): Promise<ContactResearchResponse> {
	const { contactId, fullName, email, company, title, categories } = request;

	// Verify contact exists and user has access
	const contact = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.id, contactId),
			eq(contacts.ownerId, userContext.userId)
		),
	});

	if (!contact) {
		return {
			success: false,
			contactId,
			contactName: fullName,
			results: [],
			error: "Contact not found or access denied",
		};
	}

	const queries = buildContactSearchQueries(fullName, email, company, title, categories);
	const results: ContactResearchResult[] = [];

	// Process each category
	for (const [category, query] of queries) {
		try {
			// Call search API (using Firecrawl or similar)
			const searchResponse = await fetch(
				`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/v1/research/extract`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query, maxResults: 5 }),
				}
			);

			if (searchResponse.ok) {
				const data = await searchResponse.json();
				results.push({
					category,
					title: getCategoryTitle(category),
					results: data.results || [],
					searchQuery: query,
					timestamp: new Date(),
				});
			}
		} catch (error) {
			console.error(`Research error for ${category}:`, error);
			results.push({
				category,
				title: getCategoryTitle(category),
				results: [],
				searchQuery: query,
				timestamp: new Date(),
			});
		}
	}

	return {
		success: true,
		contactId,
		contactName: fullName,
		results,
	};
}

/**
 * Save research findings to a contact.
 */
export async function saveContactResearch(
	contactId: string,
	findings: ContactResearchFindings,
	userContext: UserContext
): Promise<{ success: boolean; error?: string }> {
	try {
		// Verify access
		const contact = await db.query.contacts.findFirst({
			where: and(
				eq(contacts.id, contactId),
				eq(contacts.ownerId, userContext.userId)
			),
		});

		if (!contact) {
			return { success: false, error: "Contact not found or access denied" };
		}

		await db
			.update(contacts)
			.set({
				researchFindings: findings.summary,
				researchConfidence: findings.confidenceScore,
				lastResearchDate: new Date(),
				talkingPoints: findings.talkingPoints.map((topic) => ({
					topic,
					context: "",
				})),
				updatedAt: new Date(),
			})
			.where(eq(contacts.id, contactId));

		return { success: true };
	} catch (error) {
		console.error("Save research error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Get category display title.
 */
function getCategoryTitle(category: ContactResearchCategory): string {
	const titles: Record<ContactResearchCategory, string> = {
		linkedin: "LinkedIn Profile",
		twitter: "Twitter/X Profile",
		publications: "Publications & Articles",
		news: "News & Mentions",
		career: "Career History",
		general: "General Information",
	};
	return titles[category];
}
