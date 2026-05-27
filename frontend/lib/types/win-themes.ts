/**
 * Win Theme Orchestration Engine Types
 *
 * Type definitions for win themes, theme analysis, suggestions,
 * heat maps, consistency checking, and competitive positioning.
 */

// =============================================================================
// Core Identifiers
// =============================================================================

export type WinThemeId = string;
export type ThemeSuggestionId = string;
export type ThemeOccurrenceId = string;
export type InjectionPointId = string;
export type GhostThemeId = string;
export type CompetitorId = string;
export type CriteriaMappingId = string;

// =============================================================================
// Win Theme Types
// =============================================================================

/**
 * Type of win theme that determines its strategic purpose.
 */
export type WinThemeType =
	| "value_prop"        // Core value proposition
	| "differentiator"    // What sets us apart from competitors
	| "proof_point"       // Evidence/validation of claims
	| "risk_mitigation";  // How we reduce risk for the customer

/**
 * Theme priority level (1-5, 5 = highest).
 */
export type ThemePriority = 1 | 2 | 3 | 4 | 5;

/**
 * Theme strength indicator for coverage analysis.
 */
export type ThemeStrength = "strong" | "moderate" | "weak" | "missing";

/**
 * Status of a win theme in the proposal lifecycle.
 */
export type ThemeStatus = "draft" | "active" | "approved" | "archived";

/**
 * Core win theme data structure.
 */
export interface WinTheme {
	id: WinThemeId;
	opportunityId: string;
	/** Full theme statement */
	statement: string;
	/** Short version for quick reference (max 100 chars) */
	shortVersion: string;
	/** Type of theme */
	type: WinThemeType;
	/** Priority ranking */
	priority: ThemePriority;
	/** Current status */
	status: ThemeStatus;
	/** Display order for manual sorting */
	displayOrder: number;
	/** Supporting evidence and proof points */
	supportingEvidence: string[];
	/** Related past performance/project IDs */
	relatedProjectIds: string[];
	/** Evaluation criteria IDs this theme addresses */
	evaluationCriteriaIds: string[];
	/** Keywords for matching */
	keywords: string[];
	/** Ghost theme for competitive positioning */
	ghostTheme?: GhostTheme;
	/** Coverage metrics */
	coverageMetrics?: ThemeCoverageMetrics;
	/** Created by user ID, if known for legacy rows */
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Ghost theme for subtle competitive positioning.
 */
export interface GhostTheme {
	id: GhostThemeId;
	/** Target competitor */
	competitorId?: CompetitorId;
	competitorName?: string;
	/** Counter-positioning statement */
	counterPositioning: string;
	/** How subtle (1-5, 5 = very subtle) */
	subtletyLevel: 1 | 2 | 3 | 4 | 5;
	/** Suggested phrasing variations */
	phrasings: string[];
}

/**
 * Coverage metrics for a theme.
 */
export interface ThemeCoverageMetrics {
	totalOccurrences: number;
	strongOccurrences: number;
	moderateOccurrences: number;
	weakOccurrences: number;
	sectionsCovered: number;
	totalSections: number;
	coveragePercentage: number;
	lastAnalyzedAt: Date;
}

/**
 * Input for creating a win theme.
 */
export interface CreateWinThemeInput {
	opportunityId: string;
	statement: string;
	shortVersion: string;
	type: WinThemeType;
	priority?: ThemePriority;
	supportingEvidence?: string[];
	relatedProjectIds?: string[];
	evaluationCriteriaIds?: string[];
	keywords?: string[];
	ghostTheme?: Omit<GhostTheme, "id">;
}

/**
 * Input for updating a win theme.
 */
export interface UpdateWinThemeInput {
	statement?: string;
	shortVersion?: string;
	type?: WinThemeType;
	priority?: ThemePriority;
	status?: ThemeStatus;
	displayOrder?: number;
	supportingEvidence?: string[];
	relatedProjectIds?: string[];
	evaluationCriteriaIds?: string[];
	keywords?: string[];
	ghostTheme?: Omit<GhostTheme, "id"> | null;
}

export interface ResponseWinThemeSeedInput {
	id?: string;
	statement: string;
	shortVersion: string;
	type: WinThemeType;
	priority?: ThemePriority;
	evaluationCriteriaIds?: string[];
	requirementIds?: string[];
	targetDocumentTypes?: string[];
	supportingEvidence?: string[];
	keywords?: string[];
	rationale?: string;
	reviewDecision?: ResponseWinThemeSeedReviewDecision;
	reviewNote?: string;
}

export type ResponseWinThemeSeedReviewDecision = "approve" | "reject";

export interface CreateThemesFromResponseSeedsInput {
	opportunityId: string;
	seeds: ResponseWinThemeSeedInput[];
	reviewRequired?: boolean;
}

export interface ResponseWinThemeSeedReviewData {
	seeds: ResponseWinThemeSeedInput[];
	acceptedRequirementCount: number;
	evaluationCriteriaCount: number;
}

// =============================================================================
// Theme Suggestions
// =============================================================================

/**
 * AI-generated theme suggestion.
 */
export interface ThemeSuggestion {
	id: ThemeSuggestionId;
	opportunityId: string;
	/** Suggested theme statement */
	statement: string;
	/** Suggested short version */
	shortVersion: string;
	/** Suggested type */
	type: WinThemeType;
	/** Confidence score (0-1) */
	confidence: number;
	/** Why this theme is suggested */
	rationale: string;
	/** Source documents/sections that informed this */
	sources: {
		documentId?: string;
		sectionId?: string;
		excerpt?: string;
	}[];
	/** Suggested keywords */
	suggestedKeywords: string[];
	/** Status of the suggestion */
	status: "pending" | "accepted" | "dismissed" | "modified";
	/** If accepted with modifications, the modified version */
	modifiedVersion?: Partial<CreateWinThemeInput>;
	generatedAt: Date;
}

/**
 * Input for generating theme suggestions.
 */
export interface GenerateThemeSuggestionsInput {
	opportunityId: string;
	/** Number of suggestions to generate */
	count?: number;
	/** Focus on specific theme types */
	themeTypes?: WinThemeType[];
	/** Additional context to consider */
	additionalContext?: string;
}

// =============================================================================
// Theme Heat Map
// =============================================================================

/**
 * Heat map cell representing theme coverage in a section.
 */
export interface HeatMapCell {
	themeId: WinThemeId;
	sectionId: string;
	/** Strength of theme presence */
	strength: ThemeStrength;
	/** Number of occurrences */
	occurrenceCount: number;
	/** Quality score (0-100) */
	qualityScore: number;
	/** Specific occurrences in this cell */
	occurrenceIds: ThemeOccurrenceId[];
}

/**
 * Section information for heat map.
 */
export interface HeatMapSection {
	id: string;
	name: string;
	/** Volume this section belongs to */
	volumeId?: string;
	volumeName?: string;
	/** Page range */
	startPage?: number;
	endPage?: number;
	/** Word count */
	wordCount?: number;
}

/**
 * Volume grouping for heat map.
 */
export interface HeatMapVolume {
	id: string;
	name: string;
	sections: HeatMapSection[];
}

/**
 * Complete heat map data.
 */
export interface ThemeHeatMap {
	opportunityId: string;
	themes: WinTheme[];
	sections: HeatMapSection[];
	volumes?: HeatMapVolume[];
	cells: HeatMapCell[];
	/** Summary statistics */
	summary: {
		totalCells: number;
		strongCells: number;
		moderateCells: number;
		weakCells: number;
		missingCells: number;
		overallCoverage: number;
	};
	generatedAt: Date;
}

// =============================================================================
// Theme Occurrences
// =============================================================================

/**
 * A specific occurrence of a theme in the document.
 */
export interface ThemeOccurrence {
	id: ThemeOccurrenceId;
	themeId: WinThemeId;
	/** Document location */
	documentId: string;
	sectionId: string;
	sectionName: string;
	/** Page number if available */
	page?: number;
	/** Paragraph index */
	paragraphIndex?: number;
	/** The actual text containing the theme */
	text: string;
	/** Character offsets within the paragraph */
	startOffset?: number;
	endOffset?: number;
	/** Strength of this occurrence */
	strength: ThemeStrength;
	/** Whether this occurrence has been verified by a human */
	isVerified: boolean;
	verifiedBy?: string;
	verifiedAt?: Date;
	/** Notes about this occurrence */
	notes?: string;
	detectedAt: Date;
}

/**
 * Input for verifying an occurrence.
 */
export interface VerifyOccurrenceInput {
	occurrenceId: ThemeOccurrenceId;
	isVerified: boolean;
	notes?: string;
}

// =============================================================================
// Consistency Analysis
// =============================================================================

/**
 * Severity of a consistency issue.
 */
export type ConsistencyIssueSeverity = "critical" | "warning" | "info";

/**
 * Type of consistency issue.
 */
export type ConsistencyIssueType =
	| "gap"                  // Theme missing from important section
	| "inconsistency"        // Conflicting messages
	| "weak_coverage"        // Theme present but weak
	| "overemphasis"         // Theme repeated too often
	| "terminology"          // Inconsistent terminology
	| "priority_mismatch";   // High priority theme has low coverage

/**
 * A consistency issue found in the analysis.
 */
export interface ConsistencyIssue {
	id: string;
	type: ConsistencyIssueType;
	severity: ConsistencyIssueSeverity;
	themeId?: WinThemeId;
	themeName?: string;
	sectionId?: string;
	sectionName?: string;
	message: string;
	details: string;
	/** Suggested fix */
	recommendation: string;
}

/**
 * A recommendation from consistency analysis.
 */
export interface ConsistencyRecommendation {
	id: string;
	category: "coverage" | "consistency" | "strength" | "balance";
	priority: "high" | "medium" | "low";
	title: string;
	description: string;
	/** Themes affected */
	affectedThemeIds: WinThemeId[];
	/** Sections affected */
	affectedSectionIds: string[];
	/** Action items */
	actionItems: string[];
}

/**
 * Complete consistency analysis result.
 */
export interface ConsistencyAnalysis {
	opportunityId: string;
	/** Overall consistency score (0-100) */
	overallScore: number;
	/** Score breakdown */
	scoreBreakdown: {
		coverageScore: number;
		consistencyScore: number;
		strengthScore: number;
		balanceScore: number;
	};
	issues: ConsistencyIssue[];
	recommendations: ConsistencyRecommendation[];
	/** Themes with gaps */
	themesWithGaps: {
		themeId: WinThemeId;
		themeName: string;
		missingSections: string[];
	}[];
	analyzedAt: Date;
}

// =============================================================================
// Theme Injection
// =============================================================================

/**
 * Impact level of an injection.
 */
export type InjectionImpact = "high" | "medium" | "low";

/**
 * An AI-suggested injection point for a theme.
 */
export interface InjectionPoint {
	id: InjectionPointId;
	themeId: WinThemeId;
	themeName: string;
	/** Target location */
	sectionId: string;
	sectionName: string;
	paragraphIndex: number;
	/** Position within paragraph */
	insertPosition: "before" | "after" | "replace" | "inline";
	/** The original text (for context) */
	originalText: string;
	/** The suggested injection text */
	suggestedText: string;
	/** Preview of how it would look */
	previewText: string;
	/** Impact score */
	impactScore: number;
	impactLevel: InjectionImpact;
	/** Why this location is suggested */
	rationale: string;
	/** Status of the suggestion */
	status: "pending" | "accepted" | "rejected" | "modified";
	/** If modified, the final text used */
	modifiedText?: string;
	generatedAt: Date;
}

/**
 * Filters for injection suggestions.
 */
export interface InjectionFilters {
	themeId?: WinThemeId;
	sectionId?: string;
	minImpact?: InjectionImpact;
	status?: InjectionPoint["status"][];
}

/**
 * Input for generating injection suggestions.
 */
export interface GenerateInjectionsInput {
	opportunityId: string;
	themeId?: WinThemeId;
	sectionId?: string;
	maxSuggestions?: number;
}

// =============================================================================
// Competitive Positioning (Ghost Themes)
// =============================================================================

/**
 * Competitor profile for ghost theming.
 */
export interface Competitor {
	id: CompetitorId;
	opportunityId: string;
	name: string;
	/** Known weaknesses to exploit */
	weaknesses: string[];
	/** Their likely win themes */
	likelyThemes: string[];
	/** Our advantages over them */
	ourAdvantages: string[];
	/** Risk level they pose */
	threatLevel: "high" | "medium" | "low";
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a competitor.
 */
export interface CreateCompetitorInput {
	opportunityId: string;
	name: string;
	weaknesses?: string[];
	likelyThemes?: string[];
	ourAdvantages?: string[];
	threatLevel?: Competitor["threatLevel"];
	notes?: string;
}

/**
 * Ghost theme suggestion based on competitive analysis.
 */
export interface GhostThemeSuggestion {
	id: string;
	competitorId?: CompetitorId;
	competitorName?: string;
	/** The counter-positioning statement */
	statement: string;
	/** Different phrasing options */
	phrasings: string[];
	/** Recommended subtlety level */
	subtletyLevel: 1 | 2 | 3 | 4 | 5;
	/** Which of our themes this supports */
	supportsThemeId?: WinThemeId;
	/** Rationale */
	rationale: string;
	status: "pending" | "accepted" | "rejected";
	generatedAt: Date;
}

// =============================================================================
// Evaluation Criteria Mapping
// =============================================================================

/**
 * Mapping between a theme and evaluation criteria.
 */
export interface CriteriaThemeMapping {
	id: CriteriaMappingId;
	opportunityId: string;
	/** The evaluation criteria */
	criteriaId: string;
	criteriaName: string;
	criteriaWeight?: number;
	/** Themes mapped to this criteria */
	mappedThemes: {
		themeId: WinThemeId;
		relevanceScore: number; // 0-100
		notes?: string;
	}[];
	/** Coverage score for this criteria */
	coverageScore: number;
	/** Whether criteria is adequately addressed */
	isAdequate: boolean;
	updatedAt: Date;
}

/**
 * Input for mapping themes to criteria.
 */
export interface MapThemesToCriteriaInput {
	criteriaId: string;
	themeMappings: {
		themeId: WinThemeId;
		relevanceScore: number;
		notes?: string;
	}[];
}

// =============================================================================
// Theme Summary
// =============================================================================

/**
 * Summary statistics for themes on an opportunity.
 */
export interface ThemeSummary {
	opportunityId: string;
	totalThemes: number;
	activeThemes: number;
	/** By type */
	byType: Record<WinThemeType, number>;
	/** By status */
	byStatus: Record<ThemeStatus, number>;
	/** Coverage statistics */
	coveragePercentage: number;
	strongestTheme?: {
		id: WinThemeId;
		name: string;
		coverage: number;
	};
	weakestTheme?: {
		id: WinThemeId;
		name: string;
		coverage: number;
	};
	/** Critical gaps count */
	criticalGaps: number;
	/** Last analysis date */
	lastAnalyzedAt?: Date;
}

// =============================================================================
// Theme Reinforcement
// =============================================================================

/**
 * Generated reinforcement text for a theme.
 */
export interface ReinforcementText {
	id: string;
	themeId: WinThemeId;
	sectionId: string;
	/** Different phrasing options */
	options: {
		text: string;
		tone: "assertive" | "professional" | "technical" | "persuasive";
		wordCount: number;
	}[];
	/** Context-aware placement suggestion */
	placementSuggestion: string;
	generatedAt: Date;
}

/**
 * Input for generating reinforcement text.
 */
export interface GenerateReinforcementInput {
	themeId: WinThemeId;
	sectionId: string;
	/** Desired tone */
	tone?: ReinforcementText["options"][0]["tone"];
	/** Target word count */
	targetWordCount?: number;
	/** Number of options to generate */
	optionCount?: number;
}

// =============================================================================
// Action Result Types
// =============================================================================

export interface ActionResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export type GetThemesResult = ActionResult<WinTheme[]>;
export type GetThemeResult = ActionResult<WinTheme>;
export type CreateThemeResult = ActionResult<WinTheme>;
export type GetResponseWinThemeSeedReviewResult = ActionResult<ResponseWinThemeSeedReviewData>;
export type CreateThemesFromResponseSeedsResult = ActionResult<{
	created: WinTheme[];
	skipped: number;
	rejected: number;
	pendingReview: number;
}>;
export type UpdateThemeResult = ActionResult<WinTheme>;
export type DeleteThemeResult = ActionResult<{ deleted: boolean }>;
export type ReorderThemesResult = ActionResult<{ reordered: boolean }>;
export type GetSuggestionsResult = ActionResult<ThemeSuggestion[]>;
export type GenerateSuggestionsResult = ActionResult<ThemeSuggestion[]>;
export type AcceptSuggestionResult = ActionResult<WinTheme>;
export type GetHeatMapResult = ActionResult<ThemeHeatMap>;
export type GetConsistencyResult = ActionResult<ConsistencyAnalysis>;
export type GetOccurrencesResult = ActionResult<ThemeOccurrence[]>;
export type VerifyOccurrenceResult = ActionResult<ThemeOccurrence>;
export type GetInjectionsResult = ActionResult<InjectionPoint[]>;
export type GenerateInjectionsResult = ActionResult<InjectionPoint[]>;
export type AcceptInjectionResult = ActionResult<{ accepted: boolean }>;
export type GetCompetitorsResult = ActionResult<Competitor[]>;
export type CreateCompetitorResult = ActionResult<Competitor>;
export type GetGhostSuggestionsResult = ActionResult<GhostThemeSuggestion[]>;
export type GetCriteriaMappingsResult = ActionResult<CriteriaThemeMapping[]>;
export type MapCriteriaResult = ActionResult<CriteriaThemeMapping>;
export type GetSummaryResult = ActionResult<ThemeSummary>;
export type GetReinforcementResult = ActionResult<ReinforcementText>;
