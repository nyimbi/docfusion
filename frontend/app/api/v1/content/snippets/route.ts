/**
 * Content Library Snippets API Route
 *
 * Returns all content snippets with their analytics data for browsing
 * and semantic search.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { templateSnippets } from "@/lib/db/schema-additions";
import { snippetAnalytics, snippetEmbeddings } from "@/lib/db/schema-content-library";
import { eq, ilike, and, gte, desc, asc, sql } from "drizzle-orm";
import type { ContentType, FreshnessStatus } from "@/lib/db/schema-content-library";
import type { DocumentContent } from "@/lib/types/document";
import type { SnippetPlaceholder } from "@/lib/types/snippets";
import { normalizePlaceholderDefinitions } from "@/lib/placeholders/substitution";
import { normalizeSnippetPayload } from "@/lib/snippets/content-normalization";

// ============================================================================
// Types
// ============================================================================

interface SnippetResponse {
	id: string;
	name: string;
	content: DocumentContent;
	plainTextPreview: string;
	placeholders: SnippetPlaceholder[];
	description: string | null;
	category: string | null;
	tags: string[];
	// Analytics
	aiTags: string[];
	keyTerms: string[];
	contentType: ContentType | null;
	topicCategory: string | null;
	sectors: string[];
	technologies: string[];
	complianceFrameworks: string[];
	freshnessStatus: FreshnessStatus;
	reviewDueDate: string | null;
	lastReviewedAt: string | null;
	qualityScore: number | null;
	wordCount: number;
	// Win/loss tracking
	winCount: number;
	lossCount: number;
	winRate: number | null;
	lastUsedAt: string | null;
	// Metadata
	createdAt: string;
	updatedAt: string;
}

interface SnippetsListResponse {
	snippets: SnippetResponse[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

function normalizePositiveQueryInt(value: string | null, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(1, Math.min(maximum, parsed));
}

// ============================================================================
// Handler
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
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

		// Parse query parameters
		const searchParams = request.nextUrl.searchParams;
		const page = normalizePositiveQueryInt(searchParams.get("page"), 1);
		const pageSize = normalizePositiveQueryInt(searchParams.get("pageSize"), 50, 100);
		const search = searchParams.get("search") ?? "";
		const contentType = searchParams.get("contentType") as ContentType | null;
		const freshnessStatus = searchParams.get("freshnessStatus") as FreshnessStatus | null;
		const category = searchParams.get("category");
		const minWinRate = searchParams.get("minWinRate")
			? parseFloat(searchParams.get("minWinRate")!)
			: null;
		const sortBy = searchParams.get("sortBy") ?? "updatedAt";
		const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

		// Build base query conditions
		const conditions: ReturnType<typeof eq>[] = [
			eq(templateSnippets.organizationId, organizationId),
		];

		// Search filter (on snippets table)
		if (search) {
			conditions.push(
				sql`(
					${ilike(templateSnippets.name, `%${search}%`)} OR
					${templateSnippets.content}::text ILIKE ${`%${search}%`} OR
					${ilike(templateSnippets.description, `%${search}%`)}
				)`
			);
		}

		if (category) {
			conditions.push(eq(templateSnippets.category, category));
		}

		// Get total count
		const [countResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(templateSnippets)
			.where(conditions.length > 0 ? and(...conditions) : undefined);
		const total = countResult?.count ?? 0;

		// Fetch snippets with left join to analytics
		const results = await db
			.select({
				snippet: templateSnippets,
				analytics: snippetAnalytics,
			})
			.from(templateSnippets)
			.leftJoin(snippetAnalytics, eq(templateSnippets.id, snippetAnalytics.snippetId))
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(
				sortOrder === "desc"
					? desc(templateSnippets.updatedAt)
					: asc(templateSnippets.updatedAt)
			)
			.limit(pageSize)
			.offset((page - 1) * pageSize);

		// Filter by analytics conditions and format response
		let formattedSnippets: SnippetResponse[] = results
			.filter((r) => {
				// Filter by content type (from analytics)
				if (contentType && r.analytics?.contentType !== contentType) {
					return false;
				}
				// Filter by freshness status (from analytics)
				if (freshnessStatus && r.analytics?.freshnessStatus !== freshnessStatus) {
					return false;
				}
				// Filter by min win rate (from analytics)
				if (minWinRate !== null) {
					const winRate = r.analytics?.winRate;
					if (winRate === null || winRate === undefined || winRate < minWinRate) {
						return false;
					}
				}
				return true;
			})
			.map(({ snippet, analytics }) => {
				const normalized = normalizeSnippetPayload(snippet.content);
				return {
					id: snippet.id,
					name: snippet.name,
					content: normalized.content,
					plainTextPreview: normalized.plainTextPreview,
					placeholders: normalizePlaceholderDefinitions((snippet.placeholders ?? []) as SnippetPlaceholder[]),
					description: snippet.description,
					category: snippet.category,
					tags: (snippet.tags ?? []) as string[],
					// Analytics data (with defaults)
					aiTags: (analytics?.aiTags ?? []) as string[],
					keyTerms: (analytics?.keyTerms ?? []) as string[],
					contentType: analytics?.contentType as ContentType | null,
					topicCategory: analytics?.topicCategory ?? null,
					sectors: (analytics?.sectors ?? []) as string[],
					technologies: (analytics?.technologies ?? []) as string[],
					complianceFrameworks: (analytics?.complianceFrameworks ?? []) as string[],
					freshnessStatus: (analytics?.freshnessStatus ?? "current") as FreshnessStatus,
					reviewDueDate: analytics?.reviewDueDate?.toISOString() ?? null,
					lastReviewedAt: analytics?.lastReviewedAt?.toISOString() ?? null,
					qualityScore: analytics?.qualityScore ?? null,
					wordCount: analytics?.wordCount ?? 0, // Word count comes from analytics
					// Win/loss tracking
					winCount: analytics?.winCount ?? 0,
					lossCount: analytics?.lossCount ?? 0,
					winRate: analytics?.winRate ?? null,
					lastUsedAt: analytics?.lastUsedAt?.toISOString() ?? null,
					// Metadata
					createdAt: snippet.createdAt.toISOString(),
					updatedAt: snippet.updatedAt.toISOString(),
				};
			});

		// Sort by analytics fields if needed
		if (sortBy === "winRate") {
			formattedSnippets.sort((a, b) => {
				const aVal = a.winRate ?? -1;
				const bVal = b.winRate ?? -1;
				return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
			});
		} else if (sortBy === "qualityScore") {
			formattedSnippets.sort((a, b) => {
				const aVal = a.qualityScore ?? -1;
				const bVal = b.qualityScore ?? -1;
				return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
			});
		} else if (sortBy === "lastUsedAt") {
			formattedSnippets.sort((a, b) => {
				const aVal = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
				const bVal = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
				return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
			});
		}

		const response: SnippetsListResponse = {
			snippets: formattedSnippets,
			total,
			page,
			pageSize,
			totalPages: Math.ceil(total / pageSize),
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("Content snippets error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// ============================================================================
// POST - Create new snippet
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		// Authenticate user
		const session = await requireServerSession();
		const userId = session.user?.id ?? session.user?.email ?? "unknown";
		const organizationId = (session.user as { organizationId?: string }).organizationId;
		if (!organizationId) {
			return NextResponse.json(
				{ error: "Organization context required" },
				{ status: 403 }
			);
		}

		// Parse request body
		const body = await request.json();
		const { name, content, description, category, tags, shortcut, placeholders } = body;

		if (!name || !content) {
			return NextResponse.json(
				{ error: "Name and content are required" },
				{ status: 400 }
			);
		}

		// Generate shortcut from name if not provided
		const snippetShortcut = shortcut ?? `/${name.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`;
		const normalized = normalizeSnippetPayload(content);
		const normalizedPlaceholders = normalizePlaceholderDefinitions(
			(placeholders ?? []) as SnippetPlaceholder[]
		);

		// Create snippet
		const [snippet] = await db
			.insert(templateSnippets)
			.values({
				name,
				shortcut: snippetShortcut,
				content: normalized.content,
				placeholders: normalizedPlaceholders,
				description: description ?? null,
				category: category ?? null,
				tags: tags ?? [],
				createdBy: userId,
				organizationId,
			})
			.returning();

		const wordCount = normalized.plainTextPreview.split(/\s+/).filter(Boolean).length;
		await db.insert(snippetAnalytics).values({
			snippetId: snippet.id,
			wordCount,
			freshnessStatus: "current",
		});

		// In production, trigger embedding generation here
		// await generateSnippetEmbedding(snippet.id);

		return NextResponse.json(
			{
				...snippet,
				content: normalized.content,
				plainTextPreview: normalized.plainTextPreview,
				placeholders: normalizedPlaceholders,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("Create snippet error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
