/**
 * Research Search API
 *
 * Performs web searches to gather information about accounts.
 * Uses various search strategies based on the category.
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Types
// ============================================================================

interface SearchRequest {
	query: string;
	category: string;
}

interface SearchResult {
	title: string;
	snippet: string;
	url?: string;
	source?: string;
}

interface SearchResponse {
	success: boolean;
	results: SearchResult[];
	error?: string;
}

// ============================================================================
// Search Implementation
// ============================================================================

/**
 * Perform a web search using DuckDuckGo Instant Answer API
 * This is a free API that doesn't require authentication
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
	try {
		const encodedQuery = encodeURIComponent(query);
		const response = await fetch(
			`https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_redirect=1&skip_disambig=1`,
			{
				headers: {
					"User-Agent": "DocuFusion/1.0 (Account Research)",
				},
			}
		);

		if (!response.ok) {
			console.error("DuckDuckGo API error:", response.status);
			return [];
		}

		const data = await response.json();
		const results: SearchResult[] = [];

		// Abstract (main result)
		if (data.Abstract) {
			results.push({
				title: data.Heading || "Summary",
				snippet: data.Abstract,
				url: data.AbstractURL,
				source: data.AbstractSource,
			});
		}

		// Related topics
		if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
			for (const topic of data.RelatedTopics.slice(0, 5)) {
				if (topic.Text && !topic.Topics) {
					results.push({
						title: topic.FirstURL?.split("/").pop()?.replace(/_/g, " ") || "Related",
						snippet: topic.Text,
						url: topic.FirstURL,
						source: "DuckDuckGo",
					});
				}
			}
		}

		// Infobox data
		if (data.Infobox && data.Infobox.content) {
			for (const item of data.Infobox.content.slice(0, 3)) {
				if (item.label && item.value) {
					results.push({
						title: item.label,
						snippet: String(item.value),
						source: "Infobox",
					});
				}
			}
		}

		return results;
	} catch (error) {
		console.error("DuckDuckGo search error:", error);
		return [];
	}
}

/**
 * Perform a search using SerpAPI-style scraping (backup method)
 * This simulates what a proper search API would return
 */
async function searchFallback(query: string, category: string): Promise<SearchResult[]> {
	// For production, you would integrate with:
	// - Google Custom Search API
	// - Bing Web Search API
	// - SerpAPI
	// - Brave Search API

	// For now, return helpful guidance
	const results: SearchResult[] = [
		{
			title: `Search for: ${query}`,
			snippet: `To get real results, configure a search API. Try searching manually on Google, Bing, or DuckDuckGo with this query.`,
			url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
			source: "Manual Search Link",
		},
	];

	// Add category-specific suggestions
	switch (category) {
		case "linkedin":
			results.push({
				title: "LinkedIn Company Search",
				snippet: "Search directly on LinkedIn for company profiles and employee information.",
				url: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(query.replace("site:linkedin.com/company ", ""))}`,
				source: "LinkedIn",
			});
			break;
		case "twitter":
			results.push({
				title: "Twitter/X Search",
				snippet: "Search for mentions and profiles on Twitter/X.",
				url: `https://twitter.com/search?q=${encodeURIComponent(query.replace(/site:twitter\.com OR site:x\.com /g, ""))}`,
				source: "Twitter",
			});
			break;
		case "news":
			results.push({
				title: "Google News Search",
				snippet: "Search Google News for recent articles and press releases.",
				url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
				source: "Google News",
			});
			break;
	}

	return results;
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<SearchResponse>> {
	try {
		const body: SearchRequest = await request.json();
		const { query, category } = body;

		if (!query) {
			return NextResponse.json(
				{ success: false, results: [], error: "Query is required" },
				{ status: 400 }
			);
		}

		// Try DuckDuckGo first
		let results = await searchDuckDuckGo(query);

		// If no results, use fallback
		if (results.length === 0) {
			results = await searchFallback(query, category);
		}

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

export async function GET(): Promise<NextResponse> {
	return NextResponse.json({
		message: "Research Search API",
		usage: "POST with { query: string, category: string }",
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
