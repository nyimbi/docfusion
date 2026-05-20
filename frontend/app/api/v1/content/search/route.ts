/**
 * Content Library Semantic Search API Route
 *
 * Performs semantic search across content snippets using vector embeddings.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { templateSnippets } from "@/lib/db/schema-additions";
import { snippetAnalytics } from "@/lib/db/schema-content-library";
import { and, eq, sql } from "drizzle-orm";
import type { ContentType, FreshnessStatus } from "@/lib/db/schema-content-library";

// ============================================================================
// Types
// ============================================================================

interface SearchResult {
	id: string;
	name: string;
	content: unknown; // JSONB content
	description: string | null;
	category: string | null;
	tags: string[];
	contentType: ContentType | null;
	freshnessStatus: FreshnessStatus;
	qualityScore: number | null;
	winRate: number | null;
	similarity: number;
}

interface SearchResponse {
	results: SearchResult[];
	query: string;
	total: number;
}

function normalizeSearchLimit(limit: unknown, fallback = 20, maximum = 100): number {
	if (typeof limit !== "number" || !Number.isFinite(limit)) return fallback;
	return Math.max(1, Math.min(maximum, Math.floor(limit)));
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		// Authenticate user
		const session = await requireServerSession();
		const organizationId = (session.user as { organizationId?: string }).organizationId;
		if (!organizationId) {
			return NextResponse.json(
				{ error: "Organization context required" },
				{ status: 403 }
			);
		}

		// Parse request body
		const body = await request.json();
		const { query, limit, minSimilarity = 0.5 } = body;
		const normalizedLimit = normalizeSearchLimit(limit);

		if (!query || typeof query !== "string") {
			return NextResponse.json(
				{ error: "Query is required" },
				{ status: 400 }
			);
		}

		// In production, generate embedding for query
		// const queryEmbedding = await generateEmbedding(query);

		// For now, fall back to text search
		// This would be replaced with vector similarity search:
		// SELECT * FROM snippet_embeddings
		// ORDER BY embedding <=> $queryEmbedding
		// LIMIT $limit

		// Text-based fallback search
		const searchPattern = `%${query.toLowerCase()}%`;
		const results = await db
			.select({
				snippet: templateSnippets,
				analytics: snippetAnalytics,
			})
			.from(templateSnippets)
			.leftJoin(snippetAnalytics, eq(templateSnippets.id, snippetAnalytics.snippetId))
			.where(
				and(
					eq(templateSnippets.organizationId, organizationId),
					sql`(
						LOWER(${templateSnippets.name}) LIKE ${searchPattern} OR
						LOWER(${templateSnippets.content}) LIKE ${searchPattern} OR
						LOWER(${templateSnippets.description}) LIKE ${searchPattern}
					)`
				)
			)
			.limit(normalizedLimit);

		// Calculate pseudo-similarity scores based on text matching
		const scoredResults: SearchResult[] = results.map(({ snippet, analytics }) => {
			const nameLower = snippet.name.toLowerCase();
			const contentStr = typeof snippet.content === "string"
				? snippet.content
				: JSON.stringify(snippet.content);
			const contentLower = contentStr.toLowerCase();
			const queryLower = query.toLowerCase();

			// Simple similarity scoring
			let similarity = 0;
			if (nameLower.includes(queryLower)) similarity += 0.4;
			if (contentLower.includes(queryLower)) similarity += 0.3;

			// Boost for exact word matches
			const queryWords = queryLower.split(/\s+/);
			const nameWords = nameLower.split(/\s+/);
			const matchingWords = queryWords.filter((w) => nameWords.includes(w)).length;
			similarity += (matchingWords / queryWords.length) * 0.3;

			return {
				id: snippet.id,
				name: snippet.name,
				content: snippet.content,
				description: snippet.description,
				category: snippet.category,
				tags: (snippet.tags ?? []) as string[],
				contentType: analytics?.contentType as ContentType | null,
				freshnessStatus: (analytics?.freshnessStatus ?? "current") as FreshnessStatus,
				qualityScore: analytics?.qualityScore ?? null,
				winRate: analytics?.winRate ?? null,
				similarity: Math.min(similarity, 1),
			};
		});

		// Sort by similarity and filter by minimum
		const filteredResults = scoredResults
			.filter((r) => r.similarity >= minSimilarity)
			.sort((a, b) => b.similarity - a.similarity);

		const response: SearchResponse = {
			results: filteredResults,
			query,
			total: filteredResults.length,
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("Content search error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
