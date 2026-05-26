"use server";

/**
 * Server Actions for Content Library (Template/Snippet Extensions)
 *
 * Handles:
 * - Semantic search across templates and snippets
 * - Win/loss analytics tracking
 * - Content freshness management
 * - AI-powered content suggestions
 */

import { db } from "@/lib/db";
import {
	templateSnippets,
	templatePartials,
	templates,
	documents,
	opportunities,
	snippetEmbeddings,
	snippetAnalytics,
	snippetUsageLog,
	templateEmbeddings,
	templateAnalytics,
	templateUsageLog,
	contentSuggestions,
	partialEmbeddings,
	type SnippetAnalyticsRow,
	type SnippetUsageLogRow,
	type TemplateAnalyticsRow,
	type TemplateUsageLogRow,
	type ContentSuggestionRow,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, ilike, or, inArray, gte, lte, isNotNull, between, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUserContext, type UserContext } from "@/lib/auth-utils";
import {
	generateEmbedding,
	cosineSimilarity,
	getContentSuggestions as getAIContentSuggestions,
} from "@/lib/ai/content-library";
import type {
	ContentType,
	FreshnessStatus,
	UsageType,
	ProposalOutcome,
	SuggestionAction,
	SuggestionConfidence,
	DiscoveryMethod,
	SemanticSearchInput,
	ContentFilters,
	RecordUsageInput,
	ContentOutcomeInput,
	GenerateSuggestionsInput,
	SuggestionFeedbackInput,
	SemanticSearchResult,
	SemanticSearchResponse,
	ContentLibraryStats,
	ContentEffectivenessReport,
	SnippetWithAnalytics,
	TemplateWithAnalytics,
} from "@/lib/types/content-library";
import { logger } from "@/lib/utils/logger";

// ============================================================================
// Helper Functions for Type Conversion
// ============================================================================

type ContentLibraryUserContext = UserContext & { organizationId: string };

async function requireContentContext(organizationId?: string | null): Promise<UserContext> {
	const userContext = await requireUserContext();
	if (organizationId && organizationId !== userContext.organizationId) {
		throw new Error("Unauthorized");
	}
	return userContext;
}

async function requireContentActor(): Promise<string> {
	return (await requireContentContext()).userId;
}

async function requireContentLibraryContext(): Promise<ContentLibraryUserContext> {
	const userContext = await requireContentContext();
	if (!userContext.organizationId) {
		throw new Error("Organization context required");
	}
	return userContext as ContentLibraryUserContext;
}

function assignedOpportunityExistsSql(opportunityId: unknown, userContext: ContentLibraryUserContext): SQL {
	return sql`exists (
		select 1 from ${opportunities}
		where ${opportunities.id} = ${opportunityId}
		and (
			${opportunities.organizationId} = ${userContext.organizationId}
			or ${opportunities.organizationId} is null
		)
		and ${opportunities.assignedTo} = ${userContext.userId}
	)`;
}

function snippetUsageForAssignedOpportunityCondition(opportunityId: string, userContext: ContentLibraryUserContext): SQL {
	return and(
		eq(snippetUsageLog.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

function pendingSnippetUsageForAssignedOpportunityCondition(opportunityId: string, userContext: ContentLibraryUserContext): SQL {
	return and(
		snippetUsageForAssignedOpportunityCondition(opportunityId, userContext),
		eq(snippetUsageLog.proposalOutcome, "pending")
	)!;
}

function templateUsageForAssignedOpportunityCondition(opportunityId: string, userContext: ContentLibraryUserContext): SQL {
	return and(
		eq(templateUsageLog.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

function pendingTemplateUsageForAssignedOpportunityCondition(opportunityId: string, userContext: ContentLibraryUserContext): SQL {
	return and(
		templateUsageForAssignedOpportunityCondition(opportunityId, userContext),
		eq(templateUsageLog.proposalOutcome, "pending")
	)!;
}

/**
 * Convert null to undefined for optional fields
 */
function nullToUndefined<T>(value: T | null): T | undefined {
	return value === null ? undefined : value;
}

/**
 * Map database snippet row to SnippetWithAnalytics type
 */
function mapSnippetToInterface(
	snippet: typeof templateSnippets.$inferSelect,
	analytics?: typeof snippetAnalytics.$inferSelect | null
): SnippetWithAnalytics {
	return {
		id: snippet.id,
		name: snippet.name,
		shortcut: snippet.shortcut,
		content: snippet.content as unknown,
		description: nullToUndefined(snippet.description),
		tags: (snippet.tags ?? []) as string[],
		category: nullToUndefined(snippet.category),
		createdBy: snippet.createdBy,
		organizationId: nullToUndefined(snippet.organizationId),
		useCount: snippet.useCount,
		isPublic: snippet.isPublic,
		createdAt: snippet.createdAt.toISOString(),
		updatedAt: snippet.updatedAt.toISOString(),
		analytics: analytics ? {
			id: analytics.id,
			snippetId: analytics.snippetId,
			aiTags: (analytics.aiTags ?? []) as string[],
			keyTerms: (analytics.keyTerms ?? []) as string[],
			contentType: nullToUndefined(analytics.contentType) as ContentType | undefined,
			topicCategory: nullToUndefined(analytics.topicCategory),
			sectors: (analytics.sectors ?? []) as string[],
			technologies: (analytics.technologies ?? []) as string[],
			complianceFrameworks: (analytics.complianceFrameworks ?? []) as string[],
			topicScores: (analytics.topicScores ?? {}) as Record<string, number>,
			freshnessStatus: analytics.freshnessStatus as FreshnessStatus,
			reviewDueDate: analytics.reviewDueDate?.toISOString(),
			lastReviewedAt: analytics.lastReviewedAt?.toISOString(),
			qualityScore: nullToUndefined(analytics.qualityScore),
			wordCount: analytics.wordCount,
			winCount: analytics.winCount,
			lossCount: analytics.lossCount,
			winRate: nullToUndefined(analytics.winRate),
			lastUsedAt: analytics.lastUsedAt?.toISOString(),
			createdAt: analytics.createdAt.toISOString(),
			updatedAt: analytics.updatedAt.toISOString(),
		} : undefined,
	};
}

/**
 * Map database template row to TemplateWithAnalytics type
 */
function mapTemplateToInterface(
	template: typeof templates.$inferSelect,
	analytics?: typeof templateAnalytics.$inferSelect | null
): TemplateWithAnalytics {
	return {
		id: template.id,
		name: template.name,
		description: template.description ?? "",
		content: template.content as unknown,
		status: template.status as "draft" | "published" | "deprecated",
		visibility: template.visibility as "private" | "team" | "organization" | "public",
		createdBy: template.createdBy,
		categoryIds: (template.categoryIds ?? []) as string[],
		tags: (template.tags ?? []) as string[],
		useCount: template.useCount,
		rating: nullToUndefined(template.rating),
		ratingCount: nullToUndefined(template.ratingCount),
		createdAt: template.createdAt.toISOString(),
		updatedAt: template.updatedAt.toISOString(),
		analytics: analytics ? {
			id: analytics.id,
			templateId: analytics.templateId,
			aiTags: (analytics.aiTags ?? []) as string[],
			industries: (analytics.industries ?? []) as string[],
			rfpTypes: (analytics.rfpTypes ?? []) as string[],
			winCount: analytics.winCount,
			lossCount: analytics.lossCount,
			winRate: nullToUndefined(analytics.winRate),
			averageEvaluatorScore: nullToUndefined(analytics.averageEvaluatorScore),
			averageQualityScore: nullToUndefined(analytics.averageQualityScore),
			userSatisfaction: nullToUndefined(analytics.userSatisfaction),
			createdAt: analytics.createdAt.toISOString(),
			updatedAt: analytics.updatedAt.toISOString(),
		} : undefined,
	};
}

// ============================================================================
// Analytics Helper Functions
// ============================================================================

/**
 * Aggregate usage data by date for time series display
 */
function aggregateUsageByDate(
	usages: Array<{ createdAt: Date; proposalOutcome?: string | null }>
): Array<{ date: string; count: number }> {
	const dateMap = new Map<string, number>();

	for (const usage of usages) {
		const dateStr = usage.createdAt.toISOString().split('T')[0];
		dateMap.set(dateStr, (dateMap.get(dateStr) ?? 0) + 1);
	}

	// Sort by date and return last 30 days
	const sorted = Array.from(dateMap.entries())
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));

	return sorted.slice(-30);
}

/**
 * Calculate rolling win rate over time
 */
function calculateRollingWinRate(
	usages: Array<{ createdAt: Date; proposalOutcome?: string | null }>
): Array<{ date: string; rate: number }> {
	// Filter to decided usages only
	const decidedUsages = usages.filter(
		u => u.proposalOutcome === "won" || u.proposalOutcome === "lost"
	);

	if (decidedUsages.length === 0) return [];

	// Group by date
	const dateGroups = new Map<string, { wins: number; total: number }>();

	for (const usage of decidedUsages) {
		const dateStr = usage.createdAt.toISOString().split('T')[0];
		const current = dateGroups.get(dateStr) ?? { wins: 0, total: 0 };
		current.total++;
		if (usage.proposalOutcome === "won") {
			current.wins++;
		}
		dateGroups.set(dateStr, current);
	}

	// Calculate cumulative win rate for each date
	const sortedDates = Array.from(dateGroups.keys()).sort();
	const result: Array<{ date: string; rate: number }> = [];
	let cumulativeWins = 0;
	let cumulativeTotal = 0;

	for (const date of sortedDates) {
		const dayData = dateGroups.get(date)!;
		cumulativeWins += dayData.wins;
		cumulativeTotal += dayData.total;
		result.push({
			date,
			rate: (cumulativeWins / cumulativeTotal) * 100,
		});
	}

	return result.slice(-30);
}

// ============================================================================
// Semantic Search Actions
// ============================================================================

/**
 * Perform semantic search across content library
 */
export async function semanticSearch(input: SemanticSearchInput): Promise<SemanticSearchResponse> {
	const startTime = Date.now();
	await requireContentContext(input.filters?.organizationId);
	try {
		const { query, contentTypes = ["snippet", "template"], limit = 10, filters } = input;

		const results: SemanticSearchResult[] = [];
		let queryEmbedding: number[] | null = null;

		// Try to generate query embedding for semantic search
		try {
			const embeddingResult = await generateEmbedding(query);
			queryEmbedding = embeddingResult.embedding;
		} catch (embeddingError) {
			// Fall back to text-based search if embedding fails
			logger.warn("Embedding generation failed, using text search:", embeddingError);
		}

		// Search snippets
		if (contentTypes.includes("snippet")) {
			let snippetResults: Array<{snippet: typeof templateSnippets.$inferSelect; score: number}> = [];

			// Use semantic search if we have an embedding
			if (queryEmbedding) {
				// Get snippets with embeddings for semantic matching
				const embeddingsWithSnippets = await db
					.select({
						snippetId: snippetEmbeddings.snippetId,
						embedding: snippetEmbeddings.id, // We need to fetch full embedding data
					})
					.from(snippetEmbeddings)
					.limit(100); // Get a reasonable pool to score

				// Fetch full embedding data and calculate similarity
				for (const item of embeddingsWithSnippets) {
					const fullEmbedding = await db.query.snippetEmbeddings.findFirst({
						where: eq(snippetEmbeddings.snippetId, item.snippetId),
					});

					if (fullEmbedding) {
						// Parse the stored embedding (stored as JSON array or vector)
						const storedEmbedding = typeof fullEmbedding.embedding === 'string'
							? JSON.parse(fullEmbedding.embedding as string) as number[]
							: fullEmbedding.embedding as unknown as number[];

						if (Array.isArray(storedEmbedding)) {
							const score = cosineSimilarity(queryEmbedding, storedEmbedding);
							if (score >= 0.5) { // Only include reasonably similar results
								const snippet = await db.query.templateSnippets.findFirst({
									where: eq(templateSnippets.id, item.snippetId),
								});
								if (snippet) {
									snippetResults.push({ snippet, score });
								}
							}
						}
					}
				}

				// Sort by score
				snippetResults.sort((a, b) => b.score - a.score);
				snippetResults = snippetResults.slice(0, limit);
			}

			// Fall back to or supplement with text search
			if (snippetResults.length < limit) {
				const snippetConditions = [];
				snippetConditions.push(or(
					ilike(templateSnippets.name, `%${query}%`),
					ilike(templateSnippets.description, `%${query}%`),
				));

				if (filters?.organizationId) {
					snippetConditions.push(eq(templateSnippets.organizationId, filters.organizationId));
				}

				const textMatchSnippets = await db.query.templateSnippets.findMany({
					where: and(...snippetConditions),
					limit: limit - snippetResults.length,
				});

				// Add text matches with lower base score
				const existingIds = new Set(snippetResults.map(r => r.snippet.id));
				for (const snippet of textMatchSnippets) {
					if (!existingIds.has(snippet.id)) {
						snippetResults.push({ snippet, score: 0.6 }); // Lower score for text-only match
					}
				}
			}

			// Get analytics for matched snippets
			const snippetIds = snippetResults.map(r => r.snippet.id);
			const analyticsData = snippetIds.length > 0
				? await db.query.snippetAnalytics.findMany({
						where: inArray(snippetAnalytics.snippetId, snippetIds),
				  })
				: [];

			const analyticsMap = new Map(analyticsData.map(a => [a.snippetId, a]));

			for (const { snippet, score } of snippetResults) {
				const analytics = analyticsMap.get(snippet.id);

				// Apply filters
				if (filters?.contentType && analytics?.contentType !== filters.contentType) continue;
				if (filters?.freshnessStatus && analytics?.freshnessStatus !== filters.freshnessStatus) continue;
				if (filters?.minWinRate && (analytics?.winRate ?? 0) < filters.minWinRate) continue;
				if (filters?.minQualityScore && (analytics?.qualityScore ?? 0) < filters.minQualityScore) continue;

				results.push({
					contentType: "snippet",
					contentId: snippet.id,
					score,
					snippet: mapSnippetToInterface(snippet, analytics),
				});
			}
		}

		// Search templates
		if (contentTypes.includes("template")) {
			const templateConditions = [];
			templateConditions.push(or(
				ilike(templates.name, `%${query}%`),
				ilike(templates.description, `%${query}%`),
			));
			templateConditions.push(eq(templates.status, "published"));

			const matchingTemplates = await db.query.templates.findMany({
				where: and(...templateConditions),
				limit: limit,
			});

			// Get analytics for matched templates
			const templateIds = matchingTemplates.map(t => t.id);
			const templateAnalyticsData = templateIds.length > 0
				? await db.query.templateAnalytics.findMany({
						where: inArray(templateAnalytics.templateId, templateIds),
				  })
				: [];

			const templateAnalyticsMap = new Map(templateAnalyticsData.map(a => [a.templateId, a]));

			for (const template of matchingTemplates) {
				const analytics = templateAnalyticsMap.get(template.id);

				if (filters?.minWinRate && (analytics?.winRate ?? 0) < filters.minWinRate) continue;

				results.push({
					contentType: "template",
					contentId: template.id,
					score: 0.75,
					template: mapTemplateToInterface(template, analytics),
				});
			}
		}

		// Sort by score
		results.sort((a, b) => b.score - a.score);

		return {
			results: results.slice(0, limit),
			total: results.length,
			query,
			processingTimeMs: Date.now() - startTime,
		};
	} catch (error) {
		logger.error("Error performing semantic search:", error);
		return {
			results: [],
			total: 0,
			query: input.query,
			processingTimeMs: Date.now() - startTime,
		};
	}
}

// ============================================================================
// Usage Tracking Actions
// ============================================================================

/**
 * Record content usage in a document
 */
export async function recordContentUsage(input: RecordUsageInput): Promise<{ success: boolean; error?: string }> {
	const userId = await requireContentActor();
	try {
		if (input.contentType === "snippet") {
			await db.insert(snippetUsageLog).values({
				snippetId: input.contentId,
				documentId: input.documentId,
				opportunityId: input.opportunityId,
				usageType: input.usageType ?? "inserted",
				documentSection: input.documentSection,
				wasModified: input.wasModified ?? false,
				usedBy: userId,
				discoveryMethod: input.discoveryMethod,
				searchQuery: input.searchQuery,
			});

			// Update snippet use count
			await db.update(templateSnippets)
				.set({
					useCount: sql`${templateSnippets.useCount} + 1`,
					updatedAt: new Date(),
				})
				.where(eq(templateSnippets.id, input.contentId));

			// Update analytics last used
			await db.update(snippetAnalytics)
				.set({ lastUsedAt: new Date(), updatedAt: new Date() })
				.where(eq(snippetAnalytics.snippetId, input.contentId));

		} else if (input.contentType === "template") {
			await db.insert(templateUsageLog).values({
				templateId: input.contentId,
				documentId: input.documentId,
				opportunityId: input.opportunityId,
				usedBy: userId,
			});

			// Update template use count
			await db.update(templates)
				.set({
					useCount: sql`${templates.useCount} + 1`,
					updatedAt: new Date(),
				})
				.where(eq(templates.id, input.contentId));
		}

		return { success: true };
	} catch (error) {
		logger.error("Error recording content usage:", error);
		return { success: false, error: "Failed to record usage" };
	}
}

/**
 * Record proposal outcome for all content used
 */
export async function recordProposalOutcome(input: ContentOutcomeInput): Promise<{
	success: boolean;
	snippetsUpdated: number;
	templatesUpdated: number;
	error?: string;
}> {
	const userContext = await requireContentLibraryContext();
	try {
		const now = new Date();

		// Update all snippet usages for this opportunity
		const snippetResult = await db.update(snippetUsageLog)
			.set({
				proposalOutcome: input.outcome,
				outcomeRecordedAt: now,
			})
			.where(pendingSnippetUsageForAssignedOpportunityCondition(input.opportunityId, userContext));

		// Update all template usages for this opportunity
		const templateResult = await db.update(templateUsageLog)
			.set({
				proposalOutcome: input.outcome,
				outcomeRecordedAt: now,
				evaluatorFeedback: input.evaluatorFeedback,
			})
			.where(pendingTemplateUsageForAssignedOpportunityCondition(input.opportunityId, userContext));

		// Recalculate win rates for affected snippets
		const snippetUsages = await db.query.snippetUsageLog.findMany({
			where: snippetUsageForAssignedOpportunityCondition(input.opportunityId, userContext),
			columns: { snippetId: true },
		});

		const uniqueSnippetIds = [...new Set(snippetUsages.map(u => u.snippetId))];
		for (const snippetId of uniqueSnippetIds) {
			await recalculateSnippetWinRate(snippetId);
		}

		// Recalculate win rates for affected templates
		const templateUsages = await db.query.templateUsageLog.findMany({
			where: templateUsageForAssignedOpportunityCondition(input.opportunityId, userContext),
			columns: { templateId: true },
		});

		const uniqueTemplateIds = [...new Set(templateUsages.map(u => u.templateId))];
		for (const templateId of uniqueTemplateIds) {
			await recalculateTemplateWinRate(templateId);
		}

		return {
			success: true,
			snippetsUpdated: uniqueSnippetIds.length,
			templatesUpdated: uniqueTemplateIds.length,
		};
	} catch (error) {
		logger.error("Error recording proposal outcome:", error);
		return { success: false, snippetsUpdated: 0, templatesUpdated: 0, error: "Failed to record outcome" };
	}
}

/**
 * Recalculate win rate for a snippet
 */
async function recalculateSnippetWinRate(snippetId: string): Promise<void> {
	const usages = await db.query.snippetUsageLog.findMany({
		where: eq(snippetUsageLog.snippetId, snippetId),
		columns: { proposalOutcome: true },
	});

	const decided = usages.filter(u => u.proposalOutcome === "won" || u.proposalOutcome === "lost");
	const wins = decided.filter(u => u.proposalOutcome === "won").length;
	const losses = decided.filter(u => u.proposalOutcome === "lost").length;
	const winRate = decided.length > 0 ? (wins / decided.length) * 100 : null;

	// Upsert analytics record
	const existing = await db.query.snippetAnalytics.findFirst({
		where: eq(snippetAnalytics.snippetId, snippetId),
	});

	if (existing) {
		await db.update(snippetAnalytics)
			.set({ winCount: wins, lossCount: losses, winRate, updatedAt: new Date() })
			.where(eq(snippetAnalytics.snippetId, snippetId));
	} else {
		await db.insert(snippetAnalytics).values({
			snippetId,
			winCount: wins,
			lossCount: losses,
			winRate,
		});
	}
}

/**
 * Recalculate win rate for a template
 */
async function recalculateTemplateWinRate(templateId: string): Promise<void> {
	const usages = await db.query.templateUsageLog.findMany({
		where: eq(templateUsageLog.templateId, templateId),
		columns: { proposalOutcome: true },
	});

	const decided = usages.filter(u => u.proposalOutcome === "won" || u.proposalOutcome === "lost");
	const wins = decided.filter(u => u.proposalOutcome === "won").length;
	const losses = decided.filter(u => u.proposalOutcome === "lost").length;
	const winRate = decided.length > 0 ? (wins / decided.length) * 100 : null;

	// Upsert analytics record
	const existing = await db.query.templateAnalytics.findFirst({
		where: eq(templateAnalytics.templateId, templateId),
	});

	if (existing) {
		await db.update(templateAnalytics)
			.set({ winCount: wins, lossCount: losses, winRate, updatedAt: new Date() })
			.where(eq(templateAnalytics.templateId, templateId));
	} else {
		await db.insert(templateAnalytics).values({
			templateId,
			winCount: wins,
			lossCount: losses,
			winRate,
		});
	}
}

// ============================================================================
// Content Freshness Actions
// ============================================================================

/**
 * Update snippet freshness status
 */
export async function updateSnippetFreshness(
	snippetId: string,
	freshnessStatus: FreshnessStatus,
	reviewDueDate?: string
): Promise<{ success: boolean; error?: string }> {
	await requireContentActor();
	try {
		// Upsert analytics record
		const existing = await db.query.snippetAnalytics.findFirst({
			where: eq(snippetAnalytics.snippetId, snippetId),
		});

		const updates = {
			freshnessStatus,
			reviewDueDate: reviewDueDate ? new Date(reviewDueDate) : null,
			lastReviewedAt: freshnessStatus === "current" ? new Date() : undefined,
			updatedAt: new Date(),
		};

		if (existing) {
			await db.update(snippetAnalytics)
				.set(updates)
				.where(eq(snippetAnalytics.snippetId, snippetId));
		} else {
			await db.insert(snippetAnalytics).values({
				snippetId,
				...updates,
			});
		}

		revalidatePath("/content-library");
		return { success: true };
	} catch (error) {
		logger.error("Error updating snippet freshness:", error);
		return { success: false, error: "Failed to update freshness" };
	}
}

/**
 * Get snippets that need review
 */
export async function getSnippetsNeedingReview(limit = 20): Promise<SnippetWithAnalytics[]> {
	await requireContentActor();
	try {
		const analytics = await db.query.snippetAnalytics.findMany({
			where: or(
				eq(snippetAnalytics.freshnessStatus, "review_needed"),
				eq(snippetAnalytics.freshnessStatus, "stale"),
				and(
					isNotNull(snippetAnalytics.reviewDueDate),
					lte(snippetAnalytics.reviewDueDate, new Date()),
				),
			),
			limit,
			orderBy: [asc(snippetAnalytics.reviewDueDate)],
		});

		const snippetIds = analytics.map(a => a.snippetId);
		if (snippetIds.length === 0) return [];

		const snippets = await db.query.templateSnippets.findMany({
			where: inArray(templateSnippets.id, snippetIds),
		});

		const analyticsMap = new Map(analytics.map(a => [a.snippetId, a]));

		return snippets.map(snippet => mapSnippetToInterface(snippet, analyticsMap.get(snippet.id)));
	} catch (error) {
		logger.error("Error getting snippets needing review:", error);
		return [];
	}
}

// ============================================================================
// Content Suggestions Actions
// ============================================================================

/**
 * Generate content suggestions for a document section
 */
export async function generateContentSuggestions(input: GenerateSuggestionsInput): Promise<ContentSuggestionRow[]> {
	await requireContentActor();
	try {
		const { documentId, opportunityId, section, contextText, limit = 5 } = input;

		if (!contextText) return [];

		// Get candidate snippets for AI analysis
		const candidateSnippets = await db.query.templateSnippets.findMany({
			where: eq(templateSnippets.isPublic, true),
			limit: 20, // Get a pool of candidates for AI to evaluate
			orderBy: [desc(templateSnippets.useCount)], // Prefer frequently used snippets
		});

		if (candidateSnippets.length === 0) {
			// Fall back to semantic search
			const searchResults = await semanticSearch({
				query: contextText.slice(0, 500),
				contentTypes: ["snippet"],
				limit,
			});

			const suggestions: ContentSuggestionRow[] = [];
			for (const result of searchResults.results) {
				if (result.contentType === "snippet" && result.snippet) {
					const [suggestion] = await db.insert(contentSuggestions).values({
						documentId,
						opportunityId,
						snippetId: result.contentId,
						documentSection: section,
						contextText,
						relevanceScore: result.score * 100,
						confidence: result.score > 0.8 ? "high" : result.score > 0.6 ? "medium" : "low",
						reasoning: "Matched based on semantic similarity",
					}).returning();
					suggestions.push(suggestion);
				}
			}
			return suggestions;
		}

		// Use AI to analyze and rank snippets
		try {
			const snippetsForAI = candidateSnippets.map(s => ({
				id: s.id,
				name: s.name,
				content: typeof s.content === 'string'
					? s.content
					: JSON.stringify(s.content).slice(0, 1000),
			}));

			const aiSuggestions = await getAIContentSuggestions(
				contextText,
				section ?? "general",
				snippetsForAI
			);

			const suggestions: ContentSuggestionRow[] = [];

			for (const aiSuggestion of aiSuggestions.slice(0, limit)) {
				const [suggestion] = await db.insert(contentSuggestions).values({
					documentId,
					opportunityId,
					snippetId: aiSuggestion.snippetId,
					documentSection: section,
					contextText,
					relevanceScore: aiSuggestion.score,
					confidence: aiSuggestion.confidence as SuggestionConfidence,
					reasoning: aiSuggestion.reasoning,
				}).returning();

				suggestions.push(suggestion);
			}

			return suggestions;
		} catch (aiError) {
			logger.warn("AI suggestion generation failed, using semantic search:", aiError);

			// Fall back to semantic search
			const searchResults = await semanticSearch({
				query: contextText.slice(0, 500),
				contentTypes: ["snippet"],
				limit,
			});

			const suggestions: ContentSuggestionRow[] = [];
			for (const result of searchResults.results) {
				if (result.contentType === "snippet" && result.snippet) {
					const [suggestion] = await db.insert(contentSuggestions).values({
						documentId,
						opportunityId,
						snippetId: result.contentId,
						documentSection: section,
						contextText,
						relevanceScore: result.score * 100,
						confidence: result.score > 0.8 ? "high" : result.score > 0.6 ? "medium" : "low",
						reasoning: "Matched based on semantic similarity",
					}).returning();
					suggestions.push(suggestion);
				}
			}
			return suggestions;
		}
	} catch (error) {
		logger.error("Error generating content suggestions:", error);
		return [];
	}
}

/**
 * Provide feedback on a content suggestion
 */
export async function provideSuggestionFeedback(input: SuggestionFeedbackInput): Promise<{ success: boolean; error?: string }> {
	const userId = await requireContentActor();
	try {
		await db.update(contentSuggestions)
			.set({
				userAction: input.action,
				actionAt: new Date(),
				actionBy: userId,
				wasHelpful: input.wasHelpful,
			})
			.where(eq(contentSuggestions.id, input.suggestionId));

		return { success: true };
	} catch (error) {
		logger.error("Error providing suggestion feedback:", error);
		return { success: false, error: "Failed to save feedback" };
	}
}

// ============================================================================
// Statistics Actions
// ============================================================================

/**
 * Get content library statistics for dashboard
 */
export async function getContentLibraryStats(organizationId?: string): Promise<ContentLibraryStats> {
	const userContext = await requireContentContext(organizationId);
	try {
		const snippetCondition = userContext.organizationId
			? eq(templateSnippets.organizationId, userContext.organizationId)
			: undefined;

		// Count totals
		const [snippetCount, templateCount, partialCount] = await Promise.all([
			db.select({ count: sql<number>`count(*)` })
				.from(templateSnippets)
				.where(snippetCondition),
			db.select({ count: sql<number>`count(*)` }).from(templates),
			db.select({ count: sql<number>`count(*)` }).from(templatePartials),
		]);

		// Count embeddings
		const [snippetEmbeddingCount, templateEmbeddingCount] = await Promise.all([
			db.select({ count: sql<number>`count(*)` }).from(snippetEmbeddings),
			db.select({ count: sql<number>`count(*)` }).from(templateEmbeddings),
		]);

		// Count usages
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const [totalUsages, monthlyUsages] = await Promise.all([
			db.select({ count: sql<number>`count(*)` }).from(snippetUsageLog),
			db.select({ count: sql<number>`count(*)` })
				.from(snippetUsageLog)
				.where(gte(snippetUsageLog.createdAt, thirtyDaysAgo)),
		]);

		// Get average win rates
		const snippetAnalyticsData = await db.query.snippetAnalytics.findMany({
			where: isNotNull(snippetAnalytics.winRate),
			columns: { winRate: true },
		});

		const templateAnalyticsData = await db.query.templateAnalytics.findMany({
			where: isNotNull(templateAnalytics.winRate),
			columns: { winRate: true },
		});

		const avgSnippetWinRate = snippetAnalyticsData.length > 0
			? snippetAnalyticsData.reduce((sum, a) => sum + (a.winRate ?? 0), 0) / snippetAnalyticsData.length
			: undefined;

		const avgTemplateWinRate = templateAnalyticsData.length > 0
			? templateAnalyticsData.reduce((sum, a) => sum + (a.winRate ?? 0), 0) / templateAnalyticsData.length
			: undefined;

		// Get snippets needing review
		const needingReviewCount = await db.select({ count: sql<number>`count(*)` })
			.from(snippetAnalytics)
			.where(or(
				eq(snippetAnalytics.freshnessStatus, "review_needed"),
				eq(snippetAnalytics.freshnessStatus, "stale"),
			));

		// Count stale snippets specifically
		const staleCount = await db.select({ count: sql<number>`count(*)` })
			.from(snippetAnalytics)
			.where(eq(snippetAnalytics.freshnessStatus, "stale"));

		// Get top performing content
		const topSnippets = await getTopPerformingSnippets(5);
		const topTemplates = await getTopPerformingTemplates(5);

		return {
			totalSnippets: Number(snippetCount[0]?.count ?? 0),
			totalTemplates: Number(templateCount[0]?.count ?? 0),
			totalPartials: Number(partialCount[0]?.count ?? 0),
			snippetsWithEmbeddings: Number(snippetEmbeddingCount[0]?.count ?? 0),
			templatesWithEmbeddings: Number(templateEmbeddingCount[0]?.count ?? 0),
			totalUsages: Number(totalUsages[0]?.count ?? 0),
			usagesThisMonth: Number(monthlyUsages[0]?.count ?? 0),
			averageSnippetWinRate: avgSnippetWinRate,
			averageTemplateWinRate: avgTemplateWinRate,
			topPerformingSnippets: topSnippets,
			topPerformingTemplates: topTemplates,
			snippetsNeedingReview: Number(needingReviewCount[0]?.count ?? 0),
			staleSnippets: Number(staleCount[0]?.count ?? 0),
		};
	} catch (error) {
		logger.error("Error getting content library stats:", error);
		return {
			totalSnippets: 0,
			totalTemplates: 0,
			totalPartials: 0,
			snippetsWithEmbeddings: 0,
			templatesWithEmbeddings: 0,
			totalUsages: 0,
			usagesThisMonth: 0,
			topPerformingSnippets: [],
			topPerformingTemplates: [],
			snippetsNeedingReview: 0,
			staleSnippets: 0,
		};
	}
}

/**
 * Get top performing snippets by win rate
 */
async function getTopPerformingSnippets(limit = 5): Promise<SnippetWithAnalytics[]> {
	const topAnalytics = await db.query.snippetAnalytics.findMany({
		where: and(
			isNotNull(snippetAnalytics.winRate),
			gte(snippetAnalytics.winCount, 1), // At least 1 win
		),
		orderBy: [desc(snippetAnalytics.winRate)],
		limit,
	});

	if (topAnalytics.length === 0) return [];

	const snippetIds = topAnalytics.map(a => a.snippetId);
	const snippets = await db.query.templateSnippets.findMany({
		where: inArray(templateSnippets.id, snippetIds),
	});

	const analyticsMap = new Map(topAnalytics.map(a => [a.snippetId, a]));

	return snippets.map(snippet => mapSnippetToInterface(snippet, analyticsMap.get(snippet.id)));
}

/**
 * Get top performing templates by win rate
 */
async function getTopPerformingTemplates(limit = 5): Promise<TemplateWithAnalytics[]> {
	const topAnalytics = await db.query.templateAnalytics.findMany({
		where: and(
			isNotNull(templateAnalytics.winRate),
			gte(templateAnalytics.winCount, 1),
		),
		orderBy: [desc(templateAnalytics.winRate)],
		limit,
	});

	if (topAnalytics.length === 0) return [];

	const templateIds = topAnalytics.map(a => a.templateId);
	const matchedTemplates = await db.query.templates.findMany({
		where: inArray(templates.id, templateIds),
	});

	const analyticsMap = new Map(topAnalytics.map(a => [a.templateId, a]));

	return matchedTemplates.map(template => mapTemplateToInterface(template, analyticsMap.get(template.id)));
}

/**
 * Get effectiveness report for a piece of content
 */
export async function getContentEffectivenessReport(
	contentId: string,
	contentType: "snippet" | "template"
): Promise<ContentEffectivenessReport | null> {
	await requireContentActor();
	try {
		if (contentType === "snippet") {
			const usages = await db.query.snippetUsageLog.findMany({
				where: eq(snippetUsageLog.snippetId, contentId),
				orderBy: [asc(snippetUsageLog.createdAt)],
			});

			if (usages.length === 0) return null;

			const uniqueDocs = new Set(usages.map(u => u.documentId));
			const uniqueOpps = new Set(usages.filter(u => u.opportunityId).map(u => u.opportunityId!));

			const wins = usages.filter(u => u.proposalOutcome === "won").length;
			const losses = usages.filter(u => u.proposalOutcome === "lost").length;
			const pending = usages.filter(u => u.proposalOutcome === "pending").length;
			const decided = wins + losses;

			const modified = usages.filter(u => u.wasModified).length;

			// Aggregate usage by date (last 30 days)
			const usageByDate = aggregateUsageByDate(usages);
			const winRateByDate = calculateRollingWinRate(usages);

			return {
				contentId,
				contentType,
				totalUses: usages.length,
				uniqueDocuments: uniqueDocs.size,
				uniqueOpportunities: uniqueOpps.size,
				winCount: wins,
				lossCount: losses,
				pendingCount: pending,
				winRate: decided > 0 ? (wins / decided) * 100 : undefined,
				averageModificationRate: (modified / usages.length) * 100,
				averageAcceptanceRate: 100, // All usages are acceptances
				usageOverTime: usageByDate,
				winRateOverTime: winRateByDate,
			};
		} else {
			const usages = await db.query.templateUsageLog.findMany({
				where: eq(templateUsageLog.templateId, contentId),
				orderBy: [asc(templateUsageLog.createdAt)],
			});

			if (usages.length === 0) return null;

			const uniqueDocs = new Set(usages.map(u => u.documentId));
			const uniqueOpps = new Set(usages.filter(u => u.opportunityId).map(u => u.opportunityId!));

			const wins = usages.filter(u => u.proposalOutcome === "won").length;
			const losses = usages.filter(u => u.proposalOutcome === "lost").length;
			const pending = usages.filter(u => u.proposalOutcome === "pending").length;
			const decided = wins + losses;

			// Aggregate usage by date
			const usageByDate = aggregateUsageByDate(usages);
			const winRateByDate = calculateRollingWinRate(usages);

			return {
				contentId,
				contentType,
				totalUses: usages.length,
				uniqueDocuments: uniqueDocs.size,
				uniqueOpportunities: uniqueOpps.size,
				winCount: wins,
				lossCount: losses,
				pendingCount: pending,
				winRate: decided > 0 ? (wins / decided) * 100 : undefined,
				averageModificationRate: 0,
				averageAcceptanceRate: 100,
				usageOverTime: usageByDate,
				winRateOverTime: winRateByDate,
			};
		}
	} catch (error) {
		logger.error("Error getting content effectiveness report:", error);
		return null;
	}
}
