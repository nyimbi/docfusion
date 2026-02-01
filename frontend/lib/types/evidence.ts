/**
 * Evidence & Proof Point Optimizer Types
 *
 * Type definitions for evidence management, claim analysis,
 * strength scoring, and coverage tracking in proposals.
 *
 * These types align with the database schema in lib/db/schema-evidence.ts
 * and are used by components throughout the evidence module.
 */

// =============================================================================
// Re-export Schema Types (with aliases where needed)
// =============================================================================

// Re-export core schema types for direct use (excluding those we expand below)
export type {
	EvidenceSourceType,
	EvidenceUsageType,
	EvidenceEffectiveness,
	ClaimEvidenceStrength,
	ClaimAnalysisStatus,
	ClaimResolution,
	EvidenceMatrixType,
	GapCriticality,
	EvidenceTier,
	StrengthFactor,
	SuggestedEvidence,
	EvidenceMatrixRow,
	EvidenceMatrixColumn,
	EvidenceMatrixCell as SchemaEvidenceMatrixCell,
	EvidenceMatrixGap,
	StrengthImprovementSuggestion,
	ClaimLocation,
} from "@/lib/db/schema-evidence";

// Import schema types for internal use
import type {
	EvidenceType as SchemaEvidenceType,
	EvidenceCategory as SchemaEvidenceCategory,
	EvidenceStatus as SchemaEvidenceStatus,
	ClaimRiskLevel as SchemaClaimRiskLevel,
	ClaimType as SchemaClaimType,
} from "@/lib/db/schema-evidence";

// =============================================================================
// Extended Type Definitions (for backward compatibility with components)
// =============================================================================

/**
 * Extended evidence type that includes all values used by components.
 * Schema values: metric | testimonial | case_study | certification | award | publication | capability
 * Extended values: past_performance | reference
 */
export type EvidenceType =
	| SchemaEvidenceType
	| "past_performance"
	| "reference";

/**
 * Extended evidence category that includes all values used by components.
 * Schema values: technical | management | past_performance | cost_efficiency | innovation
 * Extended values: corporate | staffing | cost | risk
 */
export type EvidenceCategory =
	| SchemaEvidenceCategory
	| "corporate"
	| "staffing"
	| "cost"
	| "risk";

/**
 * Extended evidence status that includes all values used by components.
 * Schema values: draft | approved | archived
 * Extended values: active | expired
 */
export type EvidenceStatus =
	| SchemaEvidenceStatus
	| "active"
	| "expired";

/**
 * Extended claim risk level.
 */
export type ClaimRiskLevel = SchemaClaimRiskLevel;

/**
 * Extended claim type that includes all values used by components.
 * Schema values: capability | performance | experience | commitment | promise
 * Extended values: methodology | qualification
 */
export type ClaimType =
	| SchemaClaimType
	| "methodology"
	| "qualification";

// =============================================================================
// Core Identifiers
// =============================================================================

export type EvidenceId = string;
export type ClaimId = string;
export type ClaimAnalysisId = string;

// =============================================================================
// Strength Tier (Alias for Schema EvidenceTier)
// =============================================================================

/**
 * Strength tier for evidence quality assessment.
 * Alias for schema EvidenceTier for backward compatibility.
 */
export type EvidenceStrengthTier = "gold" | "silver" | "bronze";

// =============================================================================
// Evidence Interface (Aligned with Schema)
// =============================================================================

/**
 * Expanded evidence type - alias for EvidenceType for backward compatibility.
 */
export type ExpandedEvidenceType = EvidenceType;

/**
 * Expanded evidence category - alias for EvidenceCategory for backward compatibility.
 */
export type ExpandedEvidenceCategory = EvidenceCategory;

/**
 * Core evidence data structure aligned with database schema.
 * Includes backward-compatible field aliases for components.
 */
export interface Evidence {
	id: EvidenceId;
	organizationId: string | null;
	/** Title for quick reference */
	title: string;
	/** Full evidence content/description */
	content: string;
	/** AI-generated summary */
	summary: string | null;
	/** Type of evidence - matches schema evidenceType */
	evidenceType: ExpandedEvidenceType | null;
	/** Alias for evidenceType (backward compatibility) */
	type?: ExpandedEvidenceType | null;
	/** Category for organization */
	category: ExpandedEvidenceCategory | null;
	/** Subcategory for finer organization */
	subcategory: string | null;
	/** Tags for search and filtering */
	tags: string[];
	/** Whether evidence is quantified */
	isQuantified: boolean;
	/** Metric name */
	metric: string | null;
	/** Metric value */
	metricValue: string | null;
	/** Metric unit */
	metricUnit: string | null;
	/** Metric context/baseline */
	metricContext: string | null;
	/** Quantification object (computed from flat fields for backward compatibility) */
	quantification?: EvidenceQuantification | null;
	/** Source type - includes 'external' for backward compatibility */
	sourceType: "internal" | "customer" | "third_party" | "government" | "external" | null;
	/** Source reference */
	sourceReference: string | null;
	/** Source date */
	sourceDate: string | null;
	/** Whether source is verified */
	sourceVerified: boolean;
	/** Verification notes */
	verificationNotes: string | null;
	/** Source object (computed from flat fields for backward compatibility) */
	source?: EvidenceSource | null;
	/** Strength score (0-100) */
	strengthScore: number | null;
	/** Detailed strength factors */
	strengthFactors: import("@/lib/db/schema-evidence").StrengthFactor[] | null;
	/** Strength tier computed from score (backward compatibility) */
	strengthTier?: EvidenceStrengthTier;
	/** Detailed strength dimensions */
	strengthDimensions?: StrengthDimensions;
	/** Related capability/competency IDs */
	relatedCapabilities: string[] | null;
	/** Related NAICS codes */
	relatedNaicsCodes: string[] | null;
	/** Related agencies */
	relatedAgencies: string[] | null;
	/** Usage tracking count - schema name */
	useCount: number;
	/** Alias for useCount (backward compatibility) */
	usageCount?: number;
	/** Last used timestamp */
	lastUsedAt: Date | null;
	/** Last used opportunity ID */
	lastUsedInOpportunityId: string | null;
	/** Current status - expanded to include legacy 'active' and 'expired' */
	status: "draft" | "approved" | "archived" | "active" | "expired";
	/** Expiration date for time-sensitive evidence */
	expiresAt?: Date | null;
	/** Related project IDs for past performance */
	projectIds?: string[];
	/** Effectiveness rating from previous uses (0-100) */
	effectivenessRating?: number;
	/** Approved by user */
	approvedBy: string | null;
	/** Approved at timestamp */
	approvedAt: Date | null;
	/** Created by user ID */
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Strength dimension scores for detailed analysis.
 */
export interface StrengthDimensions {
	specificity: number;      // How specific and detailed
	recency: number;          // How recent/current
	relevance: number;        // How relevant to typical requirements
	verifiability: number;    // How easy to verify
	quantifiability: number;  // How well quantified
	credibility: number;      // Source credibility
}

/**
 * Input for creating evidence.
 */
export interface CreateEvidenceInput {
	title: string;
	content: string;
	summary?: string;
	evidenceType?: ExpandedEvidenceType;
	/** Alias for evidenceType (backward compatibility) */
	type?: ExpandedEvidenceType;
	category?: ExpandedEvidenceCategory;
	subcategory?: string;
	tags?: string[];
	isQuantified?: boolean;
	metric?: string;
	metricValue?: string;
	metricUnit?: string;
	metricContext?: string;
	/** Quantification object (backward compatibility) */
	quantification?: Omit<EvidenceQuantification, "value"> & { value?: number | string };
	sourceType?: "internal" | "customer" | "third_party" | "government" | "external";
	sourceReference?: string;
	sourceDate?: string;
	sourceVerified?: boolean;
	verificationNotes?: string;
	/** Source object (backward compatibility) */
	source?: Omit<EvidenceSource, "verified" | "verifiedBy" | "verifiedAt">;
	relatedCapabilities?: string[];
	relatedNaicsCodes?: string[];
	relatedAgencies?: string[];
	/** Related project IDs */
	projectIds?: string[];
	/** Expiration date */
	expiresAt?: Date;
	status?: "draft" | "approved" | "archived" | "active" | "expired";
}

/**
 * Input for updating evidence.
 */
export interface UpdateEvidenceInput extends Partial<CreateEvidenceInput> {}

// =============================================================================
// Claim Analysis Types
// =============================================================================

/**
 * Analysis of a claim found in a document.
 */
export interface ClaimAnalysis {
	id: ClaimAnalysisId;
	documentId: string;
	/** The claim text */
	claimText: string;
	/** Claim type - includes legacy 'methodology' and 'qualification' */
	claimType: "capability" | "performance" | "experience" | "commitment" | "promise" | "methodology" | "qualification" | null;
	/** Location in document */
	sectionId?: string;
	sectionName?: string;
	/** Page number (alias for pageNumber) */
	page?: number;
	pageNumber?: number;
	paragraphIndex?: number;
	/** Whether evidence exists */
	hasEvidence: boolean;
	/** Current evidence strength */
	evidenceStrength: "none" | "weak" | "moderate" | "strong" | EvidenceStrengthTier;
	/** Linked evidence IDs */
	linkedEvidenceIds: EvidenceId[];
	/** Suggested evidence IDs (backward compatibility alias) */
	suggestedEvidenceIds?: EvidenceId[];
	/** Suggested evidence details */
	suggestedEvidence: import("@/lib/db/schema-evidence").SuggestedEvidence[];
	/** Quantified version of claim (if applicable) */
	quantifiedVersion?: string;
	/** Quantification suggestion */
	quantificationSuggestion?: string;
	/** Risk level if unsupported */
	riskLevel: "high" | "medium" | "low" | null;
	/** Resolution status - includes legacy 'unresolved' and 'dismissed' */
	status: "open" | "in_progress" | "resolved" | "wont_fix" | "unresolved" | "dismissed";
	/** Resolution type */
	resolution?: "evidence_added" | "claim_removed" | "claim_modified" | "accepted_as_is";
	/** Resolution notes */
	resolutionNotes?: string;
	analyzedAt: Date;
}

/**
 * Summary of claim analysis for a document.
 */
export interface ClaimAnalysisSummary {
	documentId: string;
	totalClaims: number;
	byRisk: Record<"high" | "medium" | "low", number>;
	byStrength: Record<"none" | "weak" | "moderate" | "strong" | EvidenceStrengthTier, number>;
	byType: Record<string, number>;
	resolvedCount: number;
	unresolvedCount: number;
	averageStrength: number;
	lastAnalyzedAt: Date;
}

// =============================================================================
// Evidence Matrix Types
// =============================================================================

/**
 * Matrix type for evidence coverage analysis.
 */
export type MatrixType = "evaluation_criteria" | "requirements" | "sections";

/**
 * Evidence matrix cell data.
 */
export interface EvidenceMatrixCell {
	rowId: string;
	columnId: string;
	/** Evidence IDs in this cell */
	evidenceIds: EvidenceId[];
	/** Coverage level */
	coverage: "strong" | "moderate" | "weak" | "none";
	/** Coverage score (0-100) */
	coverageScore: number;
	/** Gap identified */
	isGap: boolean;
}

/**
 * Evidence coverage matrix.
 */
export interface EvidenceMatrix {
	id?: string;
	opportunityId: string;
	matrixType: MatrixType;
	name?: string;
	/** Row headers (criteria, requirements, or sections) */
	rows: {
		id: string;
		name: string;
		weight?: number;
	}[];
	/** Column headers (evidence types) */
	columns: {
		id: string;
		name: string;
	}[];
	/** Matrix cells */
	cells: EvidenceMatrixCell[];
	/** Overall coverage percentage */
	overallCoverage?: number;
	/** Gap analysis */
	gaps?: import("@/lib/db/schema-evidence").EvidenceMatrixGap[];
	/** Summary statistics */
	summary?: {
		totalCells: number;
		strongCoverage: number;
		moderateCoverage: number;
		weakCoverage: number;
		gaps: number;
		overallScore: number;
	};
	generatedAt: Date;
}

// =============================================================================
// Evidence Search & Filters
// =============================================================================

/**
 * Filters for evidence search.
 */
export interface EvidenceFilters {
	types?: ExpandedEvidenceType[];
	categories?: ExpandedEvidenceCategory[];
	strengthTiers?: EvidenceStrengthTier[];
	tags?: string[];
	status?: ("draft" | "approved" | "archived" | "active" | "expired")[];
	minStrengthScore?: number;
	maxStrengthScore?: number;
	dateRange?: {
		start?: Date;
		end?: Date;
	};
	hasQuantification?: boolean;
	relatedCapabilities?: string[];
	query?: string;
	// Filters used by actions
	evidenceType?: ExpandedEvidenceType | ExpandedEvidenceType[];
	category?: ExpandedEvidenceCategory | ExpandedEvidenceCategory[];
	isQuantified?: boolean;
	search?: string;
	limit?: number;
	offset?: number;
	orderBy?: "title" | "strengthScore" | "useCount" | "createdAt" | "updatedAt";
	orderDirection?: "asc" | "desc";
}

/**
 * Evidence search result with relevance score.
 */
export interface EvidenceSearchResult extends Evidence {
	relevanceScore: number;
	matchedFields: string[];
	highlightedContent?: string;
}

// =============================================================================
// Quantification Types
// =============================================================================

/**
 * Quantification suggestion from AI.
 */
export interface QuantificationSuggestion {
	id: string;
	originalText: string;
	quantifiedVersions: {
		text: string;
		confidence: number;
		metricType: string;
		dataSourceHints: string[];
		evidenceNeeded?: string;
		strengthIncrease?: number;
		dataSource?: string;
	}[];
	missingData: string[];
	metrics?: { name: string; unit: string; example: string }[];
	generatedAt: Date;
}

// =============================================================================
// Usage Tracking Types
// =============================================================================

/**
 * Evidence usage record.
 */
export interface EvidenceUsage {
	id: string;
	evidenceId: EvidenceId;
	opportunityId: string | null;
	opportunityName?: string;
	documentId: string | null;
	documentName?: string;
	sectionId?: string | null;
	sectionName?: string | null;
	usageType?: "direct_quote" | "paraphrased" | "supporting" | "reference" | null;
	usedText?: string | null;
	context?: string | null;
	effectiveness?: "strong" | "moderate" | "weak" | null;
	evaluatorFeedback?: string | null;
	usedAt: Date;
	usedBy: string | null;
	/** Effectiveness rating given after use (for compatibility) */
	effectivenessRating?: number;
	ratingNotes?: string;
}

/**
 * Evidence usage statistics.
 */
export interface EvidenceUsageStats {
	evidenceId: EvidenceId;
	totalUses: number;
	uniqueOpportunities: number;
	averageEffectiveness: number;
	usageByMonth: {
		month: string;
		count: number;
	}[];
	topOpportunities: {
		opportunityId: string;
		opportunityName: string;
		useCount: number;
	}[];
	lastUsedAt?: Date;
}

// =============================================================================
// Import Types
// =============================================================================

/**
 * Import column mapping.
 */
export interface ImportColumnMapping {
	sourceColumn: string;
	targetField: keyof CreateEvidenceInput | null;
	transform?: "none" | "uppercase" | "lowercase" | "date" | "number" | "tags";
}

/**
 * Import preview row.
 */
export interface ImportPreviewRow {
	rowNumber: number;
	data: Record<string, string>;
	evidence?: Partial<Evidence>;
	errors: string[];
	warnings: string[];
	status: "valid" | "warning" | "error";
}

/**
 * Import preview result.
 * Compatible with both component and action return types.
 */
export interface ImportPreview {
	totalRows: number;
	validRows: number;
	warningRows?: number;
	errorRows?: number;
	invalidRows?: number;
	duplicates?: number;
	rows?: ImportPreviewRow[];
	preview?: Partial<CreateEvidenceInput>[];
	detectedColumns?: string[];
	suggestedMappings?: ImportColumnMapping[];
	errors: Array<{ row?: number; rowNumber?: number; field?: string; message?: string; error?: string }>;
}

/**
 * Import result.
 * Compatible with both component and action return types.
 */
export interface ImportResult {
	// Action style fields
	imported?: number;
	skipped?: number;
	// Component style fields
	totalRows?: number;
	successCount?: number;
	errorCount?: number;
	skippedCount?: number;
	createdIds?: EvidenceId[];
	errors: Array<{ row?: number; rowNumber?: number; message?: string; error?: string }>;
}

// =============================================================================
// Distribution Types
// =============================================================================

/**
 * Evidence distribution data.
 */
export interface EvidenceDistribution {
	byType: {
		type: string;
		count: number;
		percentage: number;
	}[];
	byStrength: {
		tier: EvidenceStrengthTier;
		count: number;
		percentage: number;
	}[];
	byCategory: {
		category: string;
		count: number;
		percentage: number;
	}[];
	coverage: {
		score: number;
		gaps: string[];
	};
	totalCount: number;
}

// =============================================================================
// Strength Rating Types
// =============================================================================

/**
 * Strength rating with multi-dimensional analysis.
 */
export interface StrengthRating {
	overallScore: number;
	tier: EvidenceStrengthTier;
	dimensions: {
		recency: { score: number; notes: string };
		specificity: { score: number; notes: string };
		quantification: { score: number; notes: string };
		verifiability: { score: number; notes: string };
		relevance: { score: number; notes: string };
	};
	improvements: import("@/lib/db/schema-evidence").StrengthImprovementSuggestion[];
}

// =============================================================================
// Report Types
// =============================================================================

/**
 * Evidence report with summary and recommendations.
 */
export interface EvidenceReport {
	summary: {
		total: number;
		byType: Record<string, number>;
		averageStrength: number;
	};
	topEvidence: { id: string; title: string; strengthScore: number; useCount: number }[];
	weakEvidence: { id: string; title: string; issues: string[] }[];
	recommendations: string[];
}

// =============================================================================
// Action Result Types
// =============================================================================

/**
 * Standard result wrapper for server actions.
 * Uses discriminated union for type-safe success/error handling.
 */
export type ActionResult<T> =
	| { success: true; data: T; error?: never }
	| { success: false; error: string; data?: never };

export type GetEvidenceListResult = ActionResult<Evidence[]>;
export type GetEvidenceResult = ActionResult<Evidence>;
export type CreateEvidenceResult = ActionResult<Evidence>;
export type UpdateEvidenceResult = ActionResult<Evidence>;
export type DeleteEvidenceResult = ActionResult<{ deleted: boolean }>;
export type SearchEvidenceResult = ActionResult<EvidenceSearchResult[]>;
export type AnalyzeClaimsResult = ActionResult<ClaimAnalysis[]>;
export type GetClaimAnalysisResult = ActionResult<ClaimAnalysis>;
export type GetClaimsSummaryResult = ActionResult<ClaimAnalysisSummary>;
export type GetEvidenceMatrixResult = ActionResult<EvidenceMatrix>;
export type GetStrengthAnalysisResult = ActionResult<StrengthDimensions>;
export type GetQuantificationResult = ActionResult<QuantificationSuggestion>;
export type GetUsageStatsResult = ActionResult<EvidenceUsageStats>;
export type GetUsageHistoryResult = ActionResult<EvidenceUsage[]>;
export type ImportEvidenceResult = ActionResult<ImportResult>;
export type GetDistributionResult = ActionResult<EvidenceDistribution>;

// =============================================================================
// Evidence Source (Compatibility interface)
// =============================================================================

/**
 * Source information for evidence traceability.
 * Maps to the schema's sourceType, sourceReference, sourceVerified fields.
 */
export interface EvidenceSource {
	type: "internal" | "customer" | "third_party" | "government" | "external";
	name: string;
	date?: Date;
	document?: string;
	url?: string;
	contactInfo?: string;
	verified: boolean;
	verifiedBy?: string;
	verifiedAt?: Date;
}

/**
 * Evidence quantification data for metrics.
 * Maps to the schema's metric, metricValue, metricUnit, metricContext fields.
 */
export interface EvidenceQuantification {
	metric: string;
	value: number;
	unit: string;
	context?: string;
	baseline?: number;
	improvement?: number;
	timeframe?: string;
}
