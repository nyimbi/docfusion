/**
 * Quality Assessment Types - DocFusion
 *
 * Type definitions for quality assessment server actions.
 * Separated from server actions file to comply with Next.js "use server" restrictions.
 */

import type {
	QualityAssessment,
	QualityFactorResult,
	QualityFactorCategory,
	QualityIssue,
	QualitySuggestion,
	IssuePriority,
	SuggestionType,
	QualityScoreLevel,
} from "@/lib/ai/quality-assessment";

// Re-export utility functions for client-side use
export {
	getScoreLevel,
	getScoreColor,
	getScoreBgColor,
	getScoreGradient,
	getPriorityColor,
	getPriorityBgColor,
	getSuggestionTypeLabel,
	getCategoryIcon,
	getCategoryLabel,
	getPriorityCounts,
	QUALITY_FACTORS,
} from "@/lib/ai/quality-assessment";

// Re-export types
export type {
	QualityAssessment,
	QualityFactorResult,
	QualityFactorCategory,
	QualityIssue,
	QualitySuggestion,
	IssuePriority,
	SuggestionType,
	QualityScoreLevel,
};

// ============================================================================
// Response Types
// ============================================================================

export interface QualityAssessmentResponse {
	success: boolean;
	assessment?: QualityAssessment;
	error?: string;
}

export interface QualityAssessmentsListResponse {
	success: boolean;
	assessments?: QualityAssessmentSummary[];
	error?: string;
}

export interface QualityAssessmentSummary {
	id: string;
	documentId: string;
	versionId?: string;
	overallScore: number;
	scoreLevel: QualityScoreLevel;
	categoryScores: {
		category: QualityFactorCategory;
		score: number;
		issueCount: number;
	}[];
	summary: {
		wordCount: number;
		paragraphCount: number;
		issueCount: number;
	};
	assessedAt: Date;
}

export interface AssessmentComparisonResponse {
	success: boolean;
	comparison?: {
		current: QualityAssessment;
		previous: QualityAssessment | null;
		scoreDelta: number;
		improvedFactors: string[];
		declinedFactors: string[];
		newIssues: QualityIssue[];
		resolvedIssues: QualityIssue[];
	};
	error?: string;
}

export interface AssessmentOptionsInput {
	categories?: QualityFactorCategory[];
	strictMode?: boolean;
	includeFactors?: boolean;
	includeIssues?: boolean;
	includeSuggestions?: boolean;
}
