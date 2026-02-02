/**
 * Quality Assessment Server Actions - DocFusion
 *
 * Server actions for document quality assessment including:
 * - Triggering assessments with the quality assessment engine
 * - Retrieving current and historical assessment results
 * - Comparing versions of assessments
 */

"use server";

import {
	runQualityAssessment,
	compareAssessments,
	generateSummaryReport,
	getPriorityCounts,
	getScoreLevel,
	getScoreColor,
	getScoreBgColor,
	QUALITY_FACTORS,
} from "@/lib/ai/quality-assessment";
import type {
	QualityAssessment,
	QualityAssessmentInput,
	QualityFactorResult,
	QualityFactorCategory,
	QualityIssue,
	QualitySuggestion,
	IssuePriority,
	QualityScoreLevel,
} from "@/lib/ai/quality-assessment";
import type {
	QualityAssessmentResponse,
	QualityAssessmentsListResponse,
	QualityAssessmentSummary,
	AssessmentComparisonResponse,
	AssessmentOptionsInput,
} from "./quality-assessment-types";
import { db } from "@/lib/db";
import { documents, documentVersions } from "@/lib/db/schema";
import { qualityAssessments } from "@/lib/db/schema-additions";
import { eq, desc, and, asc } from "drizzle-orm";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract plain text from document content.
 * Handles different content formats (Tiptap JSON, plain text, etc.)
 */
function extractText(content: unknown): string {
	if (!content) return "";

	// Handle Tiptap JSON structure
	if (typeof content === "object" && content !== null) {
		const obj = content as Record<string, unknown>;

		// If it has content array, extract from children
		if (Array.isArray(obj.content)) {
			return obj.content.map(extractText).join("\n");
		}

		// If it's a text node
		if (typeof obj.text === "string") {
			return obj.text;
		}
	}

	// String content
	if (typeof content === "string") {
		return content;
	}

	return "";
}

/**
 * Convert database assessment row to QualityAssessment type.
 */
function dbRowToAssessment(row: typeof qualityAssessments.$inferSelect): QualityAssessment {
	return {
		id: row.id,
		documentId: row.documentId,
		versionId: row.versionId || undefined,
		overallScore: row.overallScore,
		scoreLevel: row.scoreLevel as QualityScoreLevel,
		categoryScores: (row.categoryScores as Record<string, unknown>[]).map((cs) => ({
			category: cs.category as QualityFactorCategory,
			score: cs.score as number,
			weightedScore: (cs.weightedScore as number) || (cs.score as number),
			factorCount: (cs.factorCount as number) || 0,
			issueCount: (cs.issueCount as number) || 0,
			topIssues: (cs.topIssues as QualityIssue[]) || [],
		})),
		factors: (row.factors as unknown as QualityFactorResult[]) || [],
		issues: (row.issues as unknown as QualityIssue[]) || [],
		suggestions: (row.suggestions as unknown as QualitySuggestion[]) || [],
		summary: row.summary as QualityAssessment["summary"],
		assessedAt: row.assessedAt,
		modelVersion: row.modelVersion || "unknown",
	};
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Trigger a quality assessment for a document.
 */
export async function triggerQualityAssessment(
	documentId: string,
	options: AssessmentOptionsInput = {}
): Promise<QualityAssessmentResponse> {
	try {
		const { categories, strictMode = false } = options;

		// Fetch document
		const [doc] = await db
			.select()
			.from(documents)
			.where(eq(documents.id, documentId))
			.limit(1);

		if (!doc) {
			return {
				success: false,
				error: "Document not found",
			};
		}

		// Extract content
		const content = extractText(doc.content);
		if (!content.trim()) {
			return {
				success: false,
				error: "Document has no content to assess",
			};
		}

		// Run assessment
		const assessment = runQualityAssessment(documentId, content, {
			categories,
			strictMode,
		});

		// Save to database
		await db.insert(qualityAssessments).values({
			documentId,
			versionId: null, // Could be linked to version if versioning enabled
			overallScore: assessment.overallScore,
			scoreLevel: assessment.scoreLevel,
			categoryScores: assessment.categoryScores as unknown as Record<string, unknown>[],
			factors: assessment.factors as unknown as Record<string, unknown>[],
			issues: assessment.issues as unknown as Record<string, unknown>[],
			suggestions: assessment.suggestions as unknown as Record<string, unknown>[],
			summary: assessment.summary,
			modelVersion: assessment.modelVersion,
		});

		// Filter factors if not requested
		if (options.includeFactors === false) {
			assessment.factors = [];
		}
		if (options.includeIssues === false) {
			assessment.issues = [];
		}
		if (options.includeSuggestions === false) {
			assessment.suggestions = [];
		}

		return {
			success: true,
			assessment,
		};
	} catch (error) {
		console.error("Error running quality assessment:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Get the latest quality assessment for a document.
 */
export async function getQualityAssessment(
	documentId: string,
	options: AssessmentOptionsInput = {}
): Promise<QualityAssessmentResponse> {
	try {
		const [row] = await db
			.select()
			.from(qualityAssessments)
			.where(eq(qualityAssessments.documentId, documentId))
			.orderBy(desc(qualityAssessments.assessedAt))
			.limit(1);

		if (!row) {
			return {
				success: false,
				error: "No assessment found for this document",
			};
		}

		const assessment = dbRowToAssessment(row);

		// Apply filters if specified
		if (options.includeFactors === false) {
			assessment.factors = [];
		}
		if (options.includeIssues === false) {
			assessment.issues = [];
		}
		if (options.includeSuggestions === false) {
			assessment.suggestions = [];
		}

		return {
			success: true,
			assessment,
		};
	} catch (error) {
		console.error("Error getting quality assessment:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Get all quality assessments for a document (history).
 */
export async function getQualityAssessmentHistory(
	documentId: string,
	limit = 10
): Promise<QualityAssessmentsListResponse> {
	try {
		const rows = await db
			.select({
				id: qualityAssessments.id,
				documentId: qualityAssessments.documentId,
				versionId: qualityAssessments.versionId,
				overallScore: qualityAssessments.overallScore,
				scoreLevel: qualityAssessments.scoreLevel,
				categoryScores: qualityAssessments.categoryScores,
				summary: qualityAssessments.summary,
				assessedAt: qualityAssessments.assessedAt,
			})
			.from(qualityAssessments)
			.where(eq(qualityAssessments.documentId, documentId))
			.orderBy(desc(qualityAssessments.assessedAt))
			.limit(limit);

		const assessments: QualityAssessmentSummary[] = rows.map((row) => {
			const categoryScores = (row.categoryScores as Record<string, unknown>[]).map((cs) => ({
				category: cs.category as QualityFactorCategory,
				score: cs.score as number,
				issueCount: (cs.issueCount as number) || 0,
			}));

			const summary = row.summary as QualityAssessment["summary"];
			// Calculate total issue count from category scores
			const totalIssueCount = categoryScores.reduce((sum, cs) => sum + cs.issueCount, 0);

			return {
				id: row.id,
				documentId: row.documentId,
				versionId: row.versionId || undefined,
				overallScore: row.overallScore,
				scoreLevel: row.scoreLevel as QualityScoreLevel,
				categoryScores,
				summary: {
					wordCount: summary.wordCount,
					paragraphCount: summary.paragraphCount,
					issueCount: totalIssueCount,
				},
				assessedAt: row.assessedAt,
			};
		});

		return {
			success: true,
			assessments,
		};
	} catch (error) {
		console.error("Error getting quality assessment history:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Compare current quality assessment with a previous version.
 */
export async function compareQualityAssessments(
	documentId: string,
	previousAssessmentId?: string
): Promise<AssessmentComparisonResponse> {
	try {
		// Get current assessment
		const [currentRow] = await db
			.select()
			.from(qualityAssessments)
			.where(eq(qualityAssessments.documentId, documentId))
			.orderBy(desc(qualityAssessments.assessedAt))
			.limit(1);

		if (!currentRow) {
			return {
				success: false,
				error: "No assessment found for this document",
			};
		}

		const current = dbRowToAssessment(currentRow);

		// Get previous assessment
		let previous: QualityAssessment | null = null;
		if (previousAssessmentId) {
			const [previousRow] = await db
				.select()
				.from(qualityAssessments)
				.where(eq(qualityAssessments.id, previousAssessmentId))
				.limit(1);

			if (previousRow) {
				previous = dbRowToAssessment(previousRow);
			}
		} else {
			// Get second most recent
			const rows = await db
				.select()
				.from(qualityAssessments)
				.where(eq(qualityAssessments.documentId, documentId))
				.orderBy(desc(qualityAssessments.assessedAt))
				.limit(2);

			if (rows.length > 1) {
				previous = dbRowToAssessment(rows[1]);
			}
		}

		// Run comparison - compareAssessments always returns a value
		const comparisons = compareAssessments(current, previous)!;

		return {
			success: true,
			comparison: {
				current,
				previous,
				scoreDelta: comparisons.scoreDelta,
				improvedFactors: comparisons.improvedFactors,
				declinedFactors: comparisons.declinedFactors,
				newIssues: comparisons.newIssues,
				resolvedIssues: comparisons.resolvedIssues,
			},
		};
	} catch (error) {
		console.error("Error comparing assessments:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Generate a summary report of the quality assessment.
 */
export async function generateQualityReport(
	documentId: string
): Promise<{ success: boolean; report?: string; error?: string }> {
	try {
		const response = await getQualityAssessment(documentId);

		if (!response.success || !response.assessment) {
			return {
				success: false,
				error: response.error || "No assessment found",
			};
		}

		const report = generateSummaryReport(response.assessment);

		return {
			success: true,
			report,
		};
	} catch (error) {
		console.error("Error generating quality report:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Get quality metrics for a dashboard/overview.
 */
export async function getQualityMetrics(
	documentId: string
): Promise<{
	success: boolean;
	metrics?: {
		overallScore: number;
		scoreLevel: QualityScoreLevel;
		scoreColor: string;
		scoreBgColor: string;
		categoryBreakdown: Record<QualityFactorCategory, { score: number; color: string }>;
		issueCounts: Record<IssuePriority, number>;
		suggestionCount: number;
		wordCount: number;
		readabilityGrade: number;
		activeVoicePercentage: number;
		lastAssessedAt: Date;
	};
	error?: string;
}> {
	try {
		const response = await getQualityAssessment(documentId);

		if (!response.success || !response.assessment) {
			return {
				success: false,
				error: response.error || "No assessment found",
			};
		}

		const assessment = response.assessment;

		// Build category breakdown
		const categoryBreakdown: Record<QualityFactorCategory, { score: number; color: string }> = {
			content: { score: 0, color: "" },
			structure: { score: 0, color: "" },
			style: { score: 0, color: "" },
			technical: { score: 0, color: "" },
			compliance: { score: 0, color: "" },
			strategy: { score: 0, color: "" },
		};

		for (const cs of assessment.categoryScores) {
			categoryBreakdown[cs.category] = {
				score: cs.score,
				color: getScoreColor(cs.score),
			};
		}

		// Get issue counts
		const issueCounts = getPriorityCounts(assessment.issues);

		return {
			success: true,
			metrics: {
				overallScore: assessment.overallScore,
				scoreLevel: assessment.scoreLevel,
				scoreColor: getScoreColor(assessment.overallScore),
				scoreBgColor: getScoreBgColor(assessment.overallScore),
				categoryBreakdown,
				issueCounts,
				suggestionCount: assessment.suggestions.length,
				wordCount: assessment.summary.wordCount,
				readabilityGrade: assessment.summary.readabilityGrade,
				activeVoicePercentage: assessment.summary.activeVoicePercentage,
				lastAssessedAt: assessment.assessedAt,
			},
		};
	} catch (error) {
		console.error("Error getting quality metrics:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Get available quality factor definitions.
 */
export async function getQualityFactors(): Promise<{
	success: boolean;
	factors?: typeof QUALITY_FACTORS;
	error?: string;
}> {
	return {
		success: true,
		factors: QUALITY_FACTORS,
	};
}

/**
 * Delete a quality assessment record.
 */
export async function deleteQualityAssessment(
	assessmentId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		await db.delete(qualityAssessments).where(eq(qualityAssessments.id, assessmentId));

		return { success: true };
	} catch (error) {
		console.error("Error deleting quality assessment:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

// Types and utility functions are exported from ./quality-assessment-types.ts
