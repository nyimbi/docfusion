/**
 * Research Extract API
 *
 * Searches the web, scrapes results, and uses AI to extract
 * structured account information.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAIClient } from "@/lib/ai/client";

// ============================================================================
// Configuration
// ============================================================================

const FIRECRAWL_URL = process.env.FIRECRAWL_URL || "http://20.84.71.33:3002";
const MAX_SCRAPE_URLS = 5;
const MAX_CONTENT_LENGTH = 8000; // Limit content sent to AI

// ============================================================================
// Types
// ============================================================================

interface ExtractRequest {
	accountName: string;
	website?: string;
	country?: string;
	currentData?: {
		industry?: string;
		description?: string;
	};
}

interface ExtractedInfo {
	website?: string;
	email?: string;
	phone?: string;
	headquarters?: string;
	address?: string;
	keyLeadership?: string;
	description?: string;
	industry?: string;
	sector?: string;
	employeeCount?: string;
	foundedYear?: string;
	linkedinUrl?: string;
	twitterUrl?: string;
	notableClients?: string;
	annualRevenue?: string;
	coreCapabilities?: string;
}

interface ExtractResponse {
	success: boolean;
	extracted: ExtractedInfo;
	sources: Array<{ url: string; title: string }>;
	error?: string;
}

// ============================================================================
// Firecrawl Functions
// ============================================================================

async function firecrawlSearch(query: string, limit = 8): Promise<Array<{ url: string; title: string; description?: string }>> {
	try {
		const response = await fetch(`${FIRECRAWL_URL}/v1/search`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, limit }),
		});

		if (!response.ok) return [];

		const data = await response.json();
		return (data.data || []).map((item: { url: string; title?: string; description?: string }) => ({
			url: item.url,
			title: item.title || "Untitled",
			description: item.description,
		}));
	} catch (error) {
		console.error("Search error:", error);
		return [];
	}
}

async function firecrawlScrape(url: string): Promise<{ content: string; title: string } | null> {
	try {
		const response = await fetch(`${FIRECRAWL_URL}/v1/scrape`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				url,
				formats: ["markdown"],
				onlyMainContent: true,
			}),
		});

		if (!response.ok) return null;

		const data = await response.json();
		if (data.success && data.data) {
			return {
				content: data.data.markdown || data.data.content || "",
				title: data.data.metadata?.title || url,
			};
		}
		return null;
	} catch (error) {
		console.error("Scrape error:", error);
		return null;
	}
}

// ============================================================================
// AI Extraction
// ============================================================================

const EXTRACTION_PROMPT = `You are an expert at extracting company information from web content.

Given the following web content about a company, extract any relevant business information.
Return ONLY a valid JSON object with the fields you can confidently extract.
If you cannot find information for a field, omit it entirely (do not include null or empty values).

Fields to extract:
- website: Official company website URL
- email: General contact email address
- phone: Main phone number
- headquarters: City and country of headquarters
- address: Full street address if available
- keyLeadership: Names and titles of key executives (CEO, CTO, Founders, etc.)
- description: Brief company description (2-3 sentences)
- industry: Primary industry (e.g., "Technology", "Healthcare", "Finance")
- sector: More specific sector (e.g., "Enterprise Software", "Biotech")
- employeeCount: Number of employees or range (e.g., "50-100", "500+")
- foundedYear: Year the company was founded
- linkedinUrl: LinkedIn company page URL
- twitterUrl: Twitter/X profile URL
- notableClients: List of notable clients or customers
- annualRevenue: Annual revenue estimate if publicly known
- coreCapabilities: Key products, services, or capabilities

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation, no text before or after the JSON.

Company Name: {companyName}
{additionalContext}

Web Content:
{content}

JSON:`;

async function extractWithAI(
	companyName: string,
	scrapedContent: Array<{ content: string; title: string; url: string }>,
	currentData?: ExtractRequest["currentData"]
): Promise<ExtractedInfo> {
	// Combine and truncate content
	let combinedContent = scrapedContent
		.map((s) => `=== Source: ${s.title} (${s.url}) ===\n${s.content}`)
		.join("\n\n---\n\n");

	if (combinedContent.length > MAX_CONTENT_LENGTH) {
		combinedContent = combinedContent.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated...]";
	}

	const additionalContext = currentData?.industry
		? `Current known industry: ${currentData.industry}`
		: "";

	const prompt = EXTRACTION_PROMPT
		.replace("{companyName}", companyName)
		.replace("{additionalContext}", additionalContext)
		.replace("{content}", combinedContent);

	try {
		const client = getAIClient();
		const result = await client.chat([
			{
				role: "system",
				content: "You are a precise data extraction assistant. Always return valid JSON only.",
			},
			{ role: "user", content: prompt },
		], {
			temperature: 0.1, // Low temperature for consistent extraction
			maxTokens: 2000,
		});

		// Parse the JSON response
		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			// Clean up the result - remove empty strings and nulls
			const cleaned: ExtractedInfo = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (value && typeof value === "string" && value.trim()) {
					(cleaned as Record<string, string>)[key] = value.trim();
				}
			}
			return cleaned;
		}

		return {};
	} catch (error) {
		console.error("AI extraction error:", error);
		return {};
	}
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse>> {
	try {
		const body: ExtractRequest = await request.json();
		const { accountName, website, country, currentData } = body;

		if (!accountName) {
			return NextResponse.json(
				{ success: false, extracted: {}, sources: [], error: "Account name is required" },
				{ status: 400 }
			);
		}

		const sources: Array<{ url: string; title: string }> = [];
		const scrapedContent: Array<{ content: string; title: string; url: string }> = [];

		// 1. Scrape company website if provided
		if (website) {
			console.log(`Scraping company website: ${website}`);
			const mainPage = await firecrawlScrape(website);
			if (mainPage) {
				sources.push({ url: website, title: mainPage.title });
				scrapedContent.push({ ...mainPage, url: website });
			}

			// Try about and contact pages
			for (const page of ["/about", "/about-us", "/contact", "/team", "/leadership"]) {
				try {
					const pageUrl = new URL(page, website).toString();
					const pageContent = await firecrawlScrape(pageUrl);
					if (pageContent && pageContent.content.length > 100) {
						sources.push({ url: pageUrl, title: pageContent.title });
						scrapedContent.push({ ...pageContent, url: pageUrl });
					}
				} catch {
					// Skip invalid URLs
				}
				if (scrapedContent.length >= MAX_SCRAPE_URLS) break;
			}
		}

		// 2. Search for company info
		const locationContext = country ? ` ${country}` : "";
		const searchQueries = [
			`${accountName}${locationContext} company about`,
			`${accountName}${locationContext} CEO founder leadership`,
			`${accountName} contact email phone`,
			`site:linkedin.com/company ${accountName}`,
		];

		for (const query of searchQueries) {
			if (scrapedContent.length >= MAX_SCRAPE_URLS) break;

			console.log(`Searching: ${query}`);
			const searchResults = await firecrawlSearch(query, 3);

			for (const result of searchResults) {
				if (scrapedContent.length >= MAX_SCRAPE_URLS) break;
				if (scrapedContent.some((s) => s.url === result.url)) continue;

				console.log(`Scraping: ${result.url}`);
				const content = await firecrawlScrape(result.url);
				if (content && content.content.length > 100) {
					sources.push({ url: result.url, title: content.title });
					scrapedContent.push({ ...content, url: result.url });
				}
			}
		}

		// 3. Extract information using AI
		console.log(`Extracting info from ${scrapedContent.length} sources using AI...`);
		const extracted = await extractWithAI(accountName, scrapedContent, currentData);

		return NextResponse.json({
			success: true,
			extracted,
			sources,
		});
	} catch (error) {
		console.error("Extract API error:", error);
		return NextResponse.json(
			{
				success: false,
				extracted: {},
				sources: [],
				error: error instanceof Error ? error.message : "Extraction failed",
			},
			{ status: 500 }
		);
	}
}

export async function GET(): Promise<NextResponse> {
	return NextResponse.json({
		message: "Research Extract API - AI-powered information extraction",
		usage: "POST with { accountName, website?, country?, currentData? }",
		returns: "Extracted company information with source URLs",
	});
}
