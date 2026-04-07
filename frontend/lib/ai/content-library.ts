/**
 * AI Integration for Content Library
 *
 * Provides AI-powered functions for:
 * - Semantic search with embeddings
 * - Auto-tagging content
 * - Content quality scoring
 * - Content suggestions based on context
 */

import { logger } from "@/lib/utils/logger";
import { getAIClient } from "./client";
import type { ContentType, SuggestionConfidence } from "@/lib/types/content-library";

// ============================================================================
// Types
// ============================================================================

export interface ContentLibraryAIConfig {
	model?: string;
	embeddingModel?: string;
	temperature: number;
	maxTokens: number;
}

export interface ContentEmbeddingResult {
	embedding: number[];
	model: string;
	tokens: number;
}

export interface AutoTagResult {
	tags: string[];
	contentType: ContentType;
	topicCategory?: string;
	sectors: string[];
	technologies: string[];
	complianceFrameworks: string[];
	keyTerms: string[];
	confidence: number;
}

export interface ContentQualityScore {
	overallScore: number;
	clarity: number;
	specificity: number;
	actionability: number;
	relevance: number;
	suggestions: string[];
}

export interface ContentSuggestionResult {
	snippetId: string;
	score: number;
	confidence: SuggestionConfidence;
	reasoning: string;
	matchedKeywords: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ContentLibraryAIConfig = {
	temperature: 0.1,
	maxTokens: 2048,
};

// ============================================================================
// Embedding Functions
// ============================================================================

/**
 * Generate embedding for content using the AI client.
 */
export async function generateEmbedding(
	text: string,
	config: Partial<ContentLibraryAIConfig> = {}
): Promise<ContentEmbeddingResult> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		// Truncate text to embedding model limit (~30000 chars is safe for 8k tokens)
		const truncatedText = text.slice(0, 30000);

		const response = await client.createEmbedding(truncatedText, {
			model: finalConfig.embeddingModel,
			dimensions: 1536, // Standard dimension for compatibility
		});

		return {
			embedding: response.embeddings[0],
			model: response.model,
			tokens: response.usage.totalTokens,
		};
	} catch (error) {
		logger.error("Error generating embedding:", error);
		throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function generateEmbeddingsBatch(
	texts: string[],
	config: Partial<ContentLibraryAIConfig> = {}
): Promise<ContentEmbeddingResult[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		// Truncate each text
		const truncatedTexts = texts.map((t) => t.slice(0, 30000));

		const response = await client.createEmbedding(truncatedTexts, {
			model: finalConfig.embeddingModel,
			dimensions: 1536,
		});

		return response.embeddings.map((embedding) => ({
			embedding,
			model: response.model,
			tokens: Math.floor(response.usage.totalTokens / texts.length),
		}));
	} catch (error) {
		logger.error("Error generating batch embeddings:", error);
		throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Calculate cosine similarity between two embeddings.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error("Embeddings must have the same dimension");
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	normA = Math.sqrt(normA);
	normB = Math.sqrt(normB);

	if (normA === 0 || normB === 0) {
		return 0;
	}

	return dotProduct / (normA * normB);
}

// ============================================================================
// Auto-Tagging Functions
// ============================================================================

const AUTO_TAG_PROMPT = `You are an expert at analyzing and categorizing proposal content. Analyze the following content and extract relevant metadata.

Content:
{content}

Extract:
1. Relevant tags (keywords, topics, themes)
2. Content type (boilerplate, capability, past_performance, solution, approach, bio, methodology, executive_summary, management_approach, technical_approach, staffing, quality_assurance, risk_management, transition, other)
3. Topic category
4. Industry sectors (government, healthcare, defense, IT, finance, etc.)
5. Technologies mentioned
6. Compliance frameworks mentioned (FedRAMP, NIST, ISO, CMMC, etc.)
7. Key terms and phrases

Respond in JSON:
{
  "tags": ["string"],
  "contentType": "string",
  "topicCategory": "string or null",
  "sectors": ["string"],
  "technologies": ["string"],
  "complianceFrameworks": ["string"],
  "keyTerms": ["string"],
  "confidence": "number 0-1"
}`;

/**
 * Auto-generate tags and metadata for content.
 */
export async function autoTagContent(
	content: string,
	config: Partial<ContentLibraryAIConfig> = {}
): Promise<AutoTagResult> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert content analyst. Always respond with valid JSON only, no additional text.",
				},
				{
					role: "user",
					content: AUTO_TAG_PROMPT.replace("{content}", content.slice(0, 10000)),
				},
			],
			{
				model: finalConfig.model,
				temperature: finalConfig.temperature,
				maxTokens: finalConfig.maxTokens,
			}
		);

		const responseContent = response.content;
		if (!responseContent) {
			throw new Error("No response from AI");
		}

		// Parse JSON, handling potential markdown code blocks
		const jsonStr = responseContent.replace(/```json\n?|\n?```/g, "").trim();
		return JSON.parse(jsonStr) as AutoTagResult;
	} catch (error) {
		logger.error("Error auto-tagging content:", error);
		// Return default values on error
		return {
			tags: [],
			contentType: "other",
			topicCategory: undefined,
			sectors: [],
			technologies: [],
			complianceFrameworks: [],
			keyTerms: [],
			confidence: 0,
		};
	}
}

// ============================================================================
// Content Quality Functions
// ============================================================================

const QUALITY_SCORE_PROMPT = `You are an expert proposal content reviewer. Evaluate the quality of the following content for use in government proposals.

Content:
{content}

Score each dimension from 0-100:
1. Clarity - Is the writing clear and easy to understand?
2. Specificity - Does it include specific details, metrics, and examples?
3. Actionability - Does it clearly describe capabilities and actions?
4. Relevance - Is it appropriate for government proposal use?

Also provide 2-3 specific suggestions for improvement.

Respond in JSON only:
{
  "overallScore": "number 0-100",
  "clarity": "number 0-100",
  "specificity": "number 0-100",
  "actionability": "number 0-100",
  "relevance": "number 0-100",
  "suggestions": ["string"]
}`;

/**
 * Score content quality.
 */
export async function scoreContentQuality(
	content: string,
	config: Partial<ContentLibraryAIConfig> = {}
): Promise<ContentQualityScore> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert proposal content reviewer. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: QUALITY_SCORE_PROMPT.replace("{content}", content.slice(0, 5000)),
				},
			],
			{
				model: finalConfig.model,
				temperature: 0.2,
				maxTokens: 1024,
			}
		);

		const responseContent = response.content;
		if (!responseContent) {
			throw new Error("No response from AI");
		}

		const jsonStr = responseContent.replace(/```json\n?|\n?```/g, "").trim();
		return JSON.parse(jsonStr) as ContentQualityScore;
	} catch (error) {
		logger.error("Error scoring content quality:", error);
		return {
			overallScore: 0,
			clarity: 0,
			specificity: 0,
			actionability: 0,
			relevance: 0,
			suggestions: [],
		};
	}
}

// ============================================================================
// Content Suggestion Functions
// ============================================================================

const CONTENT_SUGGESTION_PROMPT = `You are an expert at matching proposal content to requirements and context.

Context/Section being written:
{context}

Section type: {sectionType}

Available content snippets:
{snippets}

For each snippet, determine:
1. Relevance score (0-100)
2. Confidence level (high, medium, low)
3. Brief reasoning
4. Key matching keywords

Respond in JSON only:
{
  "suggestions": [
    {
      "snippetId": "string",
      "score": "number 0-100",
      "confidence": "high|medium|low",
      "reasoning": "string",
      "matchedKeywords": ["string"]
    }
  ]
}`;

/**
 * Get content suggestions based on context.
 */
export async function getContentSuggestions(
	context: string,
	sectionType: string,
	snippets: Array<{ id: string; name: string; content: string }>,
	config: Partial<ContentLibraryAIConfig> = {}
): Promise<ContentSuggestionResult[]> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	if (snippets.length === 0) {
		return [];
	}

	try {
		const client = getAIClient();

		// Prepare snippet summaries for the prompt
		const snippetSummaries = snippets.map((s) => ({
			id: s.id,
			name: s.name,
			preview: s.content.slice(0, 500),
		}));

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert at matching proposal content. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: CONTENT_SUGGESTION_PROMPT
						.replace("{context}", context.slice(0, 2000))
						.replace("{sectionType}", sectionType)
						.replace("{snippets}", JSON.stringify(snippetSummaries, null, 2)),
				},
			],
			{
				model: finalConfig.model,
				temperature: 0.2,
				maxTokens: 2048,
			}
		);

		const responseContent = response.content;
		if (!responseContent) {
			throw new Error("No response from AI");
		}

		const jsonStr = responseContent.replace(/```json\n?|\n?```/g, "").trim();
		const parsed = JSON.parse(jsonStr) as { suggestions: ContentSuggestionResult[] };
		return parsed.suggestions.filter((s) => s.score >= 50); // Only return relevant suggestions
	} catch (error) {
		logger.error("Error getting content suggestions:", error);
		return [];
	}
}

// ============================================================================
// Freshness Analysis Functions
// ============================================================================

const FRESHNESS_PROMPT = `Analyze the following content for freshness and determine if it needs updating.

Content:
{content}

Last updated: {lastUpdated}

Consider:
1. Are there any outdated references (dates, versions, technologies)?
2. Is the language and terminology current?
3. Are there any stale statistics or metrics?
4. Would the content benefit from recent developments in the field?

Respond in JSON only:
{
  "needsReview": true/false,
  "freshnessScore": "number 0-100 (100 = completely fresh)",
  "issues": ["string"],
  "suggestedUpdates": ["string"],
  "reviewDueDays": "number (0-365, how soon should this be reviewed)"
}`;

export interface FreshnessAnalysis {
	needsReview: boolean;
	freshnessScore: number;
	issues: string[];
	suggestedUpdates: string[];
	reviewDueDays: number;
}

/**
 * Analyze content freshness.
 */
export async function analyzeContentFreshness(
	content: string,
	lastUpdated: Date,
	config: Partial<ContentLibraryAIConfig> = {}
): Promise<FreshnessAnalysis> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert at evaluating content freshness. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: FRESHNESS_PROMPT
						.replace("{content}", content.slice(0, 5000))
						.replace("{lastUpdated}", lastUpdated.toISOString()),
				},
			],
			{
				model: finalConfig.model,
				temperature: 0.2,
				maxTokens: 1024,
			}
		);

		const responseContent = response.content;
		if (!responseContent) {
			throw new Error("No response from AI");
		}

		const jsonStr = responseContent.replace(/```json\n?|\n?```/g, "").trim();
		return JSON.parse(jsonStr) as FreshnessAnalysis;
	} catch (error) {
		logger.error("Error analyzing content freshness:", error);
		return {
			needsReview: false,
			freshnessScore: 50,
			issues: [],
			suggestedUpdates: [],
			reviewDueDays: 90,
		};
	}
}

// ============================================================================
// Win/Loss Correlation Functions
// ============================================================================

/**
 * Analyze content effectiveness patterns.
 */
export async function analyzeContentEffectiveness(
	snippets: Array<{
		id: string;
		content: string;
		winCount: number;
		lossCount: number;
		useCount: number;
	}>,
	config: Partial<ContentLibraryAIConfig> = {}
): Promise<{
	topPerformers: string[];
	underperformers: string[];
	patterns: string[];
	recommendations: string[];
}> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const snippetData = snippets.map((s) => ({
			id: s.id,
			preview: s.content.slice(0, 300),
			winRate: s.useCount > 0 ? (s.winCount / s.useCount) * 100 : 0,
			useCount: s.useCount,
		}));

		const prompt = `Analyze the following content snippets and their win/loss data to identify patterns:

${JSON.stringify(snippetData, null, 2)}

Identify:
1. Top performing snippets and what makes them effective
2. Underperforming snippets and potential issues
3. Common patterns in winning vs losing content
4. Recommendations for content improvement

Respond in JSON only:
{
  "topPerformers": ["snippet IDs"],
  "underperformers": ["snippet IDs"],
  "patterns": ["observed patterns"],
  "recommendations": ["improvement recommendations"]
}`;

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert at analyzing proposal content effectiveness. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			{
				model: finalConfig.model,
				temperature: 0.3,
				maxTokens: 2048,
			}
		);

		const responseContent = response.content;
		if (!responseContent) {
			throw new Error("No response from AI");
		}

		const jsonStr = responseContent.replace(/```json\n?|\n?```/g, "").trim();
		return JSON.parse(jsonStr);
	} catch (error) {
		logger.error("Error analyzing content effectiveness:", error);
		return {
			topPerformers: [],
			underperformers: [],
			patterns: [],
			recommendations: [],
		};
	}
}

// ============================================================================
// Content Enhancement Functions
// ============================================================================

/**
 * Suggest improvements for content.
 */
export async function suggestContentEnhancements(
	content: string,
	targetSection?: string,
	requirements?: string,
	config: Partial<ContentLibraryAIConfig> = {}
): Promise<{
	enhancedContent: string;
	changes: string[];
	addedValue: string[];
}> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		const client = getAIClient();

		const prompt = `Enhance the following proposal content to make it more compelling and effective.

Current content:
${content}

${targetSection ? `Target section: ${targetSection}` : ""}
${requirements ? `Requirements to address: ${requirements}` : ""}

Improve the content by:
1. Making it more specific with metrics and examples
2. Using action-oriented language
3. Highlighting differentiators
4. Addressing evaluator concerns

Respond in JSON only:
{
  "enhancedContent": "the improved content",
  "changes": ["list of changes made"],
  "addedValue": ["new value propositions or differentiators added"]
}`;

		const response = await client.chat(
			[
				{
					role: "system",
					content: "You are an expert proposal writer. Always respond with valid JSON only.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			{
				model: finalConfig.model,
				temperature: 0.4,
				maxTokens: 4096,
			}
		);

		const responseContent = response.content;
		if (!responseContent) {
			throw new Error("No response from AI");
		}

		const jsonStr = responseContent.replace(/```json\n?|\n?```/g, "").trim();
		return JSON.parse(jsonStr);
	} catch (error) {
		logger.error("Error suggesting content enhancements:", error);
		return {
			enhancedContent: content,
			changes: [],
			addedValue: [],
		};
	}
}
