/**
 * Research Search API
 *
 * Performs web searches to gather information about accounts.
 * Uses Firecrawl for web scraping and search.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// ============================================================================
// Configuration
// ============================================================================

const FIRECRAWL_URL = process.env.FIRECRAWL_URL || "http://84.247.181.100:3002";

// ============================================================================
// Types
// ============================================================================

interface SearchRequest {
	query: string;
	category: string;
	url?: string; // Optional URL to scrape directly
}

interface SearchResult {
	title: string;
	snippet: string;
	url?: string;
	source?: string;
	metadata?: Record<string, unknown>;
}

interface SearchResponse {
	success: boolean;
	results: SearchResult[];
	error?: string;
}

interface FirecrawlSearchResult {
	url: string;
	title: string;
	description?: string;
	markdown?: string;
	content?: string;
}

interface FirecrawlScrapeResult {
	success: boolean;
	data?: {
		markdown?: string;
		content?: string;
		metadata?: {
			title?: string;
			description?: string;
			ogTitle?: string;
			ogDescription?: string;
			[key: string]: unknown;
		};
		links?: string[];
	};
	error?: string;
}

// ============================================================================
// Firecrawl Integration
// ============================================================================

/**
 * Search the web using Firecrawl's search endpoint
 */
async function firecrawlSearch(query: string, limit = 10): Promise<SearchResult[]> {
	try {
		const response = await fetch(`${FIRECRAWL_URL}/v1/search`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				limit,
				scrapeOptions: {
					formats: ["markdown"],
				},
			}),
		});

		if (!response.ok) {
			console.error("Firecrawl search error:", response.status, await response.text());
			return [];
		}

		const data = await response.json();
		const results: SearchResult[] = [];

		if (data.data && Array.isArray(data.data)) {
			for (const item of data.data as FirecrawlSearchResult[]) {
				results.push({
					title: item.title || "Untitled",
					snippet: item.description || item.markdown?.slice(0, 300) || item.content?.slice(0, 300) || "",
					url: item.url,
					source: new URL(item.url).hostname,
				});
			}
		}

		return results;
	} catch (error) {
		console.error("Firecrawl search error:", error);
		return [];
	}
}

/**
 * Scrape a specific URL using Firecrawl
 */
async function firecrawlScrape(url: string): Promise<SearchResult | null> {
	try {
		const response = await fetch(`${FIRECRAWL_URL}/v1/scrape`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url,
				formats: ["markdown"],
				onlyMainContent: true,
			}),
		});

		if (!response.ok) {
			console.error("Firecrawl scrape error:", response.status);
			return null;
		}

		const data: FirecrawlScrapeResult = await response.json();

		if (data.success && data.data) {
			const content = data.data.markdown || data.data.content || "";
			return {
				title: data.data.metadata?.title || data.data.metadata?.ogTitle || url,
				snippet: data.data.metadata?.description || data.data.metadata?.ogDescription || content.slice(0, 500),
				url,
				source: new URL(url).hostname,
				metadata: data.data.metadata,
			};
		}

		return null;
	} catch (error) {
		console.error("Firecrawl scrape error:", error);
		return null;
	}
}

/**
 * Extract specific information from a company website
 */
async function scrapeCompanyWebsite(websiteUrl: string): Promise<SearchResult[]> {
	const results: SearchResult[] = [];

	// Scrape main page
	const mainPage = await firecrawlScrape(websiteUrl);
	if (mainPage) {
		results.push({
			...mainPage,
			title: `${mainPage.title} (Homepage)`,
		});
	}

	// Try to scrape common pages
	const commonPages = ["/about", "/contact", "/team", "/leadership", "/about-us", "/contact-us"];

	for (const page of commonPages.slice(0, 3)) {
		try {
			const pageUrl = new URL(page, websiteUrl).toString();
			const pageResult = await firecrawlScrape(pageUrl);
			if (pageResult && pageResult.snippet.length > 50) {
				results.push(pageResult);
			}
		} catch {
			// Skip invalid URLs
		}
	}

	return results;
}

/**
 * Build optimized search queries based on category
 * Note: Avoid quotes - they reduce result count with Firecrawl
 */
function buildSearchQuery(baseQuery: string, category: string): string {
	// Remove any existing quotes from the base query
	const cleanQuery = baseQuery.replace(/["""]/g, "");

	switch (category) {
		case "company_info":
			return `${cleanQuery} company profile about overview`;
		case "contacts":
			return `${cleanQuery} contact email phone address`;
		case "management":
			return `${cleanQuery} CEO founder leadership team executives`;
		case "clients":
			return `${cleanQuery} clients customers case studies portfolio`;
		case "linkedin":
			return `site:linkedin.com/company ${cleanQuery}`;
		case "twitter":
			return `site:twitter.com ${cleanQuery}`;
		case "news":
			return `${cleanQuery} news announcement press release 2025 2026`;
		default:
			return cleanQuery;
	}
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<SearchResponse>> {
	// Verify authentication
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json(
			{ success: false, results: [], error: "Authentication required" },
			{ status: 401 }
		);
	}

	try {
		const body: SearchRequest = await request.json();
		const { query, category, url } = body;

		if (!query && !url) {
			return NextResponse.json(
				{ success: false, results: [], error: "Query or URL is required" },
				{ status: 400 }
			);
		}

		let results: SearchResult[] = [];

		// If a specific URL is provided, scrape it directly
		if (url) {
			if (category === "company_info") {
				// Scrape the company website thoroughly
				results = await scrapeCompanyWebsite(url);
			} else {
				// Scrape the specific URL
				const scraped = await firecrawlScrape(url);
				if (scraped) {
					results.push(scraped);
				}
			}
		}

		// Perform web search with optimized query
		if (query) {
			const optimizedQuery = buildSearchQuery(query, category);
			const searchResults = await firecrawlSearch(optimizedQuery, 8);
			results = [...results, ...searchResults];
		}

		// Deduplicate by URL
		const seen = new Set<string>();
		results = results.filter((r) => {
			if (!r.url) return true;
			if (seen.has(r.url)) return false;
			seen.add(r.url);
			return true;
		});

		return NextResponse.json({
			success: true,
			results,
		});
	} catch (error) {
		console.error("Search API error:", error);
		return NextResponse.json(
			{
				success: false,
				results: [],
				error: error instanceof Error ? error.message : "Search failed",
			},
			{ status: 500 }
		);
	}
}

/**
 * Scrape a single URL endpoint
 */
export async function PUT(request: NextRequest): Promise<NextResponse<SearchResponse>> {
	// Verify authentication
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json(
			{ success: false, results: [], error: "Authentication required" },
			{ status: 401 }
		);
	}

	try {
		const body = await request.json();
		const { url } = body;

		if (!url) {
			return NextResponse.json(
				{ success: false, results: [], error: "URL is required" },
				{ status: 400 }
			);
		}

		const result = await firecrawlScrape(url);

		if (result) {
			return NextResponse.json({
				success: true,
				results: [result],
			});
		}

		return NextResponse.json({
			success: false,
			results: [],
			error: "Failed to scrape URL",
		});
	} catch (error) {
		console.error("Scrape API error:", error);
		return NextResponse.json(
			{
				success: false,
				results: [],
				error: error instanceof Error ? error.message : "Scrape failed",
			},
			{ status: 500 }
		);
	}
}

export async function GET(): Promise<NextResponse> {
	// Verify authentication
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json(
			{ error: "Authentication required" },
			{ status: 401 }
		);
	}

	return NextResponse.json({
		message: "Research Search API (Powered by Firecrawl)",
		firecrawlUrl: FIRECRAWL_URL,
		endpoints: {
			"POST /api/v1/research/search": "Search web with { query, category, url? }",
			"PUT /api/v1/research/search": "Scrape specific URL with { url }",
		},
		categories: [
			"company_info",
			"contacts",
			"management",
			"clients",
			"linkedin",
			"twitter",
			"news",
			"general",
		],
	});
}
