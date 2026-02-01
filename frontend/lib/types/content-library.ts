/**
 * TypeScript types for Content Library (Template/Snippet Extensions)
 *
 * These types support:
 * - Semantic search across templates and snippets
 * - Win/loss analytics for content effectiveness
 * - Content freshness and quality tracking
 * - AI-powered content suggestions
 */

// ============================================================================
// Content Classification Types
// ============================================================================

/** Types of reusable content */
export type ContentType =
	| "boilerplate"
	| "capability"
	| "past_performance"
	| "solution"
	| "approach"
	| "bio"
	| "methodology"
	| "executive_summary"
	| "management_approach"
	| "technical_approach"
	| "staffing"
	| "quality_assurance"
	| "risk_management"
	| "transition"
	| "other";

/** Content freshness status */
export type FreshnessStatus = "current" | "review_needed" | "stale" | "archived";

/** How content was used */
export type UsageType = "inserted" | "referenced" | "adapted";

/** Proposal outcome for tracking */
export type ProposalOutcome = "pending" | "won" | "lost" | "no_decision" | "cancelled";

/** User action on a suggestion */
export type SuggestionAction = "pending" | "accepted" | "rejected" | "ignored";

/** Confidence level for AI suggestions (content library) */
export type SuggestionConfidence = "high" | "medium" | "low";

/** How content was discovered */
export type DiscoveryMethod = "search" | "browse" | "suggestion" | "direct";

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Extended analytics for a template snippet
 */
export interface SnippetAnalytics {
	id: string;
	snippetId: string;

	// AI Classification
	aiTags: string[];
	keyTerms: string[];
	contentType?: ContentType;
	topicCategory?: string;
	sectors: string[];
	technologies: string[];
	complianceFrameworks: string[];
	topicScores: Record<string, number>;

	// Quality & Freshness
	freshnessStatus: FreshnessStatus;
	reviewDueDate?: string;
	lastReviewedAt?: string;
	qualityScore?: number;
	wordCount: number;

	// Win/Loss Tracking
	winCount: number;
	lossCount: number;
	winRate?: number;
	lastUsedAt?: string;

	createdAt: string;
	updatedAt: string;
}

/**
 * Extended analytics for a template
 */
export interface TemplateAnalytics {
	id: string;
	templateId: string;

	// AI Classification
	aiTags: string[];
	industries: string[];
	rfpTypes: string[];

	// Win/Loss Tracking
	winCount: number;
	lossCount: number;
	winRate?: number;
	averageEvaluatorScore?: number;

	// Quality Metrics
	averageQualityScore?: number;
	userSatisfaction?: number;

	createdAt: string;
	updatedAt: string;
}

// ============================================================================
// Usage Tracking Types
// ============================================================================

/**
 * Record of snippet usage in a document
 */
export interface SnippetUsage {
	id: string;
	snippetId: string;
	documentId: string;
	opportunityId?: string;

	// Usage Details
	usageType: UsageType;
	documentSection?: string;
	wasModified: boolean;

	// Outcome
	proposalOutcome: ProposalOutcome;
	outcomeRecordedAt?: string;

	// Context
	usedBy: string;
	discoveryMethod?: DiscoveryMethod;
	searchQuery?: string;

	createdAt: string;
}

/**
 * Record of template usage in a document
 */
export interface TemplateUsage {
	id: string;
	templateId: string;
	documentId: string;
	opportunityId?: string;

	// Outcome
	proposalOutcome: ProposalOutcome;
	outcomeRecordedAt?: string;
	evaluatorFeedback?: string;

	// Context
	usedBy: string;

	createdAt: string;
}

// ============================================================================
// Content Suggestion Types
// ============================================================================

/**
 * AI-generated content suggestion
 */
export interface ContentSuggestion {
	id: string;
	documentId: string;
	opportunityId?: string;
	snippetId?: string;
	templateId?: string;

	// Suggestion Context
	documentSection?: string;
	contextText?: string;
	relevanceScore: number;
	confidence: SuggestionConfidence;
	reasoning?: string;

	// User Action
	userAction: SuggestionAction;
	actionAt?: string;
	actionBy?: string;

	// Feedback
	wasHelpful?: boolean;

	// Metadata
	modelVersion?: string;
	createdAt: string;
}

/**
 * Content suggestion with full details
 */
export interface ContentSuggestionWithContent extends ContentSuggestion {
	snippet?: SnippetWithAnalytics;
	template?: TemplateWithAnalytics;
}

// ============================================================================
// Embedding Types
// ============================================================================

/**
 * Embedding record for semantic search
 */
export interface ContentEmbedding {
	id: string;
	contentId: string; // snippetId, templateId, or partialId
	contentType: "snippet" | "template" | "partial";
	plainText: string;
	modelVersion: string;
	generatedAt: string;
}

// ============================================================================
// Combined Types (with analytics)
// ============================================================================

/**
 * Snippet with analytics data
 */
export interface SnippetWithAnalytics {
	id: string;
	name: string;
	shortcut: string;
	content: unknown; // Tiptap JSON
	description?: string;
	tags: string[];
	category?: string;
	createdBy: string;
	organizationId?: string;
	useCount: number;
	isPublic: boolean;
	createdAt: string;
	updatedAt: string;

	// Analytics extension
	analytics?: SnippetAnalytics;
}

/**
 * Template with analytics data
 */
export interface TemplateWithAnalytics {
	id: string;
	name: string;
	description: string;
	content: unknown; // Tiptap JSON
	status: "draft" | "published" | "deprecated";
	visibility: "private" | "team" | "organization" | "public";
	createdBy: string;
	categoryIds: string[];
	tags: string[];
	useCount: number;
	rating?: number;
	ratingCount?: number;
	createdAt: string;
	updatedAt: string;

	// Analytics extension
	analytics?: TemplateAnalytics;
}

// ============================================================================
// Input Types
// ============================================================================

/** Input for semantic search */
export interface SemanticSearchInput {
	query: string;
	contentTypes?: ("snippet" | "template" | "partial")[];
	limit?: number;
	filters?: ContentFilters;
}

/** Filters for content search */
export interface ContentFilters {
	contentType?: ContentType;
	freshnessStatus?: FreshnessStatus;
	category?: string;
	tags?: string[];
	sectors?: string[];
	technologies?: string[];
	complianceFrameworks?: string[];
	minWinRate?: number;
	minQualityScore?: number;
	organizationId?: string;
}

/** Input for recording content usage */
export interface RecordUsageInput {
	contentType: "snippet" | "template";
	contentId: string;
	documentId: string;
	opportunityId?: string;
	usageType?: UsageType;
	documentSection?: string;
	wasModified?: boolean;
	discoveryMethod?: DiscoveryMethod;
	searchQuery?: string;
}

/** Input for recording content proposal outcome */
export interface ContentOutcomeInput {
	opportunityId: string;
	outcome: ProposalOutcome;
	evaluatorFeedback?: string;
}

/** Input for updating snippet analytics */
export interface UpdateSnippetAnalyticsInput {
	snippetId: string;
	freshnessStatus?: FreshnessStatus;
	reviewDueDate?: string;
}

/** Input for generating content suggestions */
export interface GenerateSuggestionsInput {
	documentId: string;
	opportunityId?: string;
	section?: string;
	contextText?: string;
	limit?: number;
}

/** Input for providing suggestion feedback */
export interface SuggestionFeedbackInput {
	suggestionId: string;
	action: SuggestionAction;
	wasHelpful?: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

/** Semantic search result */
export interface SemanticSearchResult {
	contentType: "snippet" | "template" | "partial";
	contentId: string;
	score: number; // Similarity score 0-1
	snippet?: SnippetWithAnalytics;
	template?: TemplateWithAnalytics;
	highlights?: string[]; // Matching text snippets
}

/** Semantic search response */
export interface SemanticSearchResponse {
	results: SemanticSearchResult[];
	total: number;
	query: string;
	processingTimeMs: number;
}

/** Content library dashboard stats */
export interface ContentLibraryStats {
	totalSnippets: number;
	totalTemplates: number;
	totalPartials: number;
	snippetsWithEmbeddings: number;
	templatesWithEmbeddings: number;

	// Usage stats
	totalUsages: number;
	usagesThisMonth: number;

	// Win/Loss stats
	averageSnippetWinRate?: number;
	averageTemplateWinRate?: number;
	topPerformingSnippets: SnippetWithAnalytics[];
	topPerformingTemplates: TemplateWithAnalytics[];

	// Freshness stats
	snippetsNeedingReview: number;
	staleSnippets: number;
}

/** Content effectiveness report */
export interface ContentEffectivenessReport {
	contentId: string;
	contentType: "snippet" | "template";

	// Usage metrics
	totalUses: number;
	uniqueDocuments: number;
	uniqueOpportunities: number;

	// Outcome metrics
	winCount: number;
	lossCount: number;
	pendingCount: number;
	winRate?: number;

	// Quality metrics
	averageModificationRate: number;
	averageAcceptanceRate: number;

	// Trends
	usageOverTime: Array<{ date: string; count: number }>;
	winRateOverTime: Array<{ date: string; rate: number }>;
}

// ============================================================================
// Batch Operation Types
// ============================================================================

/** Input for bulk generating embeddings */
export interface GenerateEmbeddingsInput {
	contentType: "snippet" | "template" | "partial" | "all";
	contentIds?: string[];
	regenerateExisting?: boolean;
}

/** Result of embedding generation */
export interface GenerateEmbeddingsResult {
	total: number;
	generated: number;
	failed: number;
	errors: Array<{ contentId: string; error: string }>;
	processingTimeMs: number;
}

/** Input for bulk updating analytics */
export interface UpdateAnalyticsBatchInput {
	snippetIds?: string[];
	templateIds?: string[];
	recalculateWinRates?: boolean;
	recalculateFreshness?: boolean;
}

/** Result of analytics update */
export interface UpdateAnalyticsResult {
	snippetsUpdated: number;
	templatesUpdated: number;
	processingTimeMs: number;
}
