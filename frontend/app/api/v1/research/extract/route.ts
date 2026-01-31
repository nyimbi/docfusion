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
const MAX_SCRAPE_URLS = 8;
const MAX_CONTENT_LENGTH = 12000; // Limit content sent to AI

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

const EXTRACTION_PROMPT = `You are an expert business intelligence analyst extracting company information from multiple web sources.

Your task: Synthesize information from ALL provided sources to build a comprehensive company profile.
Cross-reference data across sources for accuracy. Prefer official company sources over third-party.

EXTRACTION RULES:
1. Extract ALL available information - be thorough
2. Combine information from multiple sources (e.g., CEO name from one source, their title from another)
3. For leadership, extract ALL mentioned executives with their full titles
4. For contact info, look for patterns like "contact@", "info@", phone numbers with country codes
5. For clients, extract any mentioned customers, partners, or case studies
6. Infer industry/sector from the company description if not explicitly stated
7. Look for founding dates, employee counts, and revenue in company profiles and news

Fields to extract (include ALL you can find):
- website: Official company website URL (look for canonical URLs)
- email: General contact email (info@, contact@, hello@)
- phone: Main phone number with country code
- headquarters: "City, Country" format
- address: Full street address if available
- keyLeadership: Format as "Name - Title, Name - Title" (extract ALL executives mentioned)
- description: 2-3 sentence summary of what the company does
- industry: Primary industry (Technology, Healthcare, Finance, Consulting, etc.)
- sector: Specific sector (Enterprise Software, Biotech, Investment Banking, etc.)
- employeeCount: Number or range (e.g., "50-100", "500+", "1000-5000")
- foundedYear: Year founded (4 digits)
- linkedinUrl: Full LinkedIn company page URL
- twitterUrl: Full Twitter/X profile URL
- notableClients: Comma-separated list of clients/customers mentioned
- annualRevenue: Revenue if mentioned (e.g., "$10M-50M", "€5 million")
- coreCapabilities: Key products, services, technologies, or specializations

Company Name: {companyName}
{additionalContext}

=== WEB CONTENT FROM MULTIPLE SOURCES ===
{content}
=== END OF CONTENT ===

CRITICAL: Return ONLY a valid JSON object. No markdown, no explanation, no text outside the JSON.
Extract as much as possible - more data is better. Synthesize across all sources.

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
// Gap Analysis & Targeted Search
// ============================================================================

/**
 * Identify critical fields that are missing
 */
function identifyMissingFields(extracted: ExtractedInfo): string[] {
	const criticalFields: Array<keyof ExtractedInfo> = [
		"email",
		"phone",
		"keyLeadership",
		"description",
		"linkedinUrl",
	];

	const missing: string[] = [];
	for (const field of criticalFields) {
		if (!extracted[field]) {
			missing.push(field);
		}
	}
	return missing;
}

/**
 * Generate targeted search query for a specific missing field
 */
function getTargetedSearchQuery(
	companyName: string,
	field: string,
	locationContext: string
): string | null {
	const strategies: Record<string, string> = {
		email: `${companyName} contact email address`,
		phone: `${companyName} phone number contact`,
		keyLeadership: `${companyName} CEO founder executives management team`,
		description: `${companyName} company about what does do`,
		linkedinUrl: `site:linkedin.com/company ${companyName}`,
		headquarters: `${companyName}${locationContext} headquarters office location`,
		employeeCount: `${companyName} employees team size headcount`,
		foundedYear: `${companyName} founded established year history`,
		notableClients: `${companyName} customers clients case studies`,
		industry: `${companyName} industry sector business`,
	};

	return strategies[field] || null;
}

/**
 * Merge two extracted data objects (second takes precedence for non-empty values)
 */
function mergeExtractedData(
	first: ExtractedInfo,
	second: ExtractedInfo
): ExtractedInfo {
	const merged: ExtractedInfo = { ...first };

	for (const [key, value] of Object.entries(second)) {
		if (value && typeof value === "string" && value.trim()) {
			// Take longer/more detailed values for text fields
			const existingValue = (merged as Record<string, string | undefined>)[key];
			if (!existingValue || value.length > existingValue.length) {
				(merged as Record<string, string>)[key] = value;
			}
		}
	}

	return merged;
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

		// 2. Multi-strategy search for comprehensive information
		const locationContext = country ? ` ${country}` : "";

		// Strategy 1: General company information
		const primaryQueries = [
			`${accountName}${locationContext} company about profile overview`,
			`${accountName}${locationContext} CEO founder leadership team executives`,
			`${accountName} contact email phone address headquarters`,
		];

		// Strategy 2: Social media and professional networks
		const socialQueries = [
			`site:linkedin.com/company ${accountName}`,
			`site:crunchbase.com ${accountName}`,
			`site:bloomberg.com/profile/company ${accountName}`,
		];

		// Strategy 3: News and press for recent info
		const newsQueries = [
			`${accountName}${locationContext} news funding announcement 2024 2025 2026`,
			`${accountName} press release latest`,
		];

		// Strategy 4: Business directories and databases
		const directoryQueries = [
			`${accountName}${locationContext} company profile dnb hoovers`,
			`${accountName} employees revenue glassdoor`,
			`${accountName}${locationContext} clients customers portfolio`,
		];

		// Combine all strategies
		const allQueries = [
			...primaryQueries,
			...socialQueries,
			...newsQueries,
			...directoryQueries,
		];

		// Execute searches with deduplication
		const seenUrls = new Set(scrapedContent.map((s) => s.url));

		for (const query of allQueries) {
			if (scrapedContent.length >= MAX_SCRAPE_URLS) break;

			console.log(`Searching: ${query}`);
			const searchResults = await firecrawlSearch(query, 3);

			for (const result of searchResults) {
				if (scrapedContent.length >= MAX_SCRAPE_URLS) break;
				if (seenUrls.has(result.url)) continue;

				// Skip low-value URLs
				const urlLower = result.url.toLowerCase();
				if (
					urlLower.includes("login") ||
					urlLower.includes("signin") ||
					urlLower.includes("signup") ||
					urlLower.includes("/search?") ||
					urlLower.includes("google.com/search")
				) {
					continue;
				}

				console.log(`Scraping: ${result.url}`);
				const content = await firecrawlScrape(result.url);
				if (content && content.content.length > 100) {
					sources.push({ url: result.url, title: content.title });
					scrapedContent.push({ ...content, url: result.url });
					seenUrls.add(result.url);
				}
			}
		}

		// Strategy 5: If still missing key info, try targeted searches
		if (scrapedContent.length < 4) {
			console.log("Running fallback searches for more information...");
			const fallbackQueries = [
				`"${accountName}" official website`,
				`${accountName} company information`,
				`who is the CEO of ${accountName}`,
			];

			for (const query of fallbackQueries) {
				if (scrapedContent.length >= MAX_SCRAPE_URLS) break;

				const results = await firecrawlSearch(query, 2);
				for (const result of results) {
					if (scrapedContent.length >= MAX_SCRAPE_URLS) break;
					if (seenUrls.has(result.url)) continue;

					const content = await firecrawlScrape(result.url);
					if (content && content.content.length > 100) {
						sources.push({ url: result.url, title: content.title });
						scrapedContent.push({ ...content, url: result.url });
						seenUrls.add(result.url);
					}
				}
			}
		}

		// 3. Extract information using AI
		console.log(`Extracting info from ${scrapedContent.length} sources using AI...`);
		let extracted = await extractWithAI(accountName, scrapedContent, currentData);

		// 4. Analyze gaps and attempt to fill them
		const missingCritical = identifyMissingFields(extracted);

		if (missingCritical.length > 0 && scrapedContent.length < MAX_SCRAPE_URLS) {
			console.log(`Missing critical fields: ${missingCritical.join(", ")}. Running targeted searches...`);

			const additionalContent: Array<{ content: string; title: string; url: string }> = [];
			const seenUrls = new Set(sources.map((s) => s.url));

			// Targeted searches for missing info
			for (const field of missingCritical) {
				if (additionalContent.length >= 3) break;

				const targetedQuery = getTargetedSearchQuery(accountName, field, locationContext);
				if (!targetedQuery) continue;

				console.log(`Targeted search for ${field}: ${targetedQuery}`);
				const results = await firecrawlSearch(targetedQuery, 2);

				for (const result of results) {
					if (additionalContent.length >= 3) break;
					if (seenUrls.has(result.url)) continue;

					const content = await firecrawlScrape(result.url);
					if (content && content.content.length > 100) {
						sources.push({ url: result.url, title: content.title });
						additionalContent.push({ ...content, url: result.url });
						seenUrls.add(result.url);
					}
				}
			}

			// Re-run extraction with additional content
			if (additionalContent.length > 0) {
				console.log(`Re-extracting with ${additionalContent.length} additional sources...`);
				const allContent = [...scrapedContent, ...additionalContent];
				const newExtracted = await extractWithAI(accountName, allContent, currentData);

				// Merge results (new data takes precedence for non-empty fields)
				extracted = mergeExtractedData(extracted, newExtracted);
			}
		}

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
