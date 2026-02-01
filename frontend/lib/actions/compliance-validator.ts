"use server";

/**
 * Compliance Validator Server Actions
 *
 * Provides comprehensive compliance validation for RFP responses including:
 * - Bidirectional cross-reference validation
 * - Coverage scoring and gap analysis
 * - AI-powered compliance suggestions
 * - Heat map data generation
 */

import { db } from "@/lib/db";
import {
	rfpRequirements,
	complianceMatrices,
	complianceEntries,
	rfpDocuments,
} from "@/lib/db/schema-rfp";
import { documents } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireUserContext } from "@/lib/auth-utils";

// ============================================================================
// Types
// ============================================================================

export interface ComplianceIssue {
	type: "missing" | "partial" | "over_referenced" | "weak" | "mismatch";
	severity: "critical" | "high" | "medium" | "low";
	requirementId: string;
	requirementNumber: string;
	description: string;
	location?: string;
	suggestion?: string;
}

export interface ComplianceSuggestion {
	requirementId: string;
	type: "add_reference" | "improve_coverage" | "clarify" | "restructure";
	description: string;
	priority: "high" | "medium" | "low";
	suggestedAction?: string;
	suggestedContent?: string;
}

export interface ValidationResult {
	isValid: boolean;
	coverageScore: number;
	mandatoryCoverageScore: number;
	totalRequirements: number;
	mandatoryRequirements: number;
	addressedRequirements: number;
	issues: ComplianceIssue[];
	suggestions: ComplianceSuggestion[];
	timestamp: string;
}

export interface MissingReference {
	requirementId: string;
	requirementNumber: string;
	requirementText: string;
	category: string;
	priority: string;
	suggestedSections: string[];
}

export interface OverReference {
	requirementId: string;
	requirementNumber: string;
	referenceCount: number;
	locations: string[];
	recommendation: string;
}

export interface BidirectionalValidation {
	requirementsWithoutResponse: MissingReference[];
	responsesWithoutRequirement: {
		documentSection: string;
		content: string;
		potentialMatches: string[];
	}[];
	orphanedCrossReferences: {
		location: string;
		targetRequirement: string;
		issue: string;
	}[];
}

export interface HeatMapData {
	categories: {
		name: string;
		totalRequirements: number;
		addressedRequirements: number;
		complianceRate: number;
		mandatoryCount: number;
		mandatoryAddressed: number;
		subcategories: {
			name: string;
			totalRequirements: number;
			addressedRequirements: number;
			complianceRate: number;
		}[];
	}[];
	overallScore: number;
	mandatoryScore: number;
}

export interface SuggestedLocation {
	documentId: string;
	documentTitle: string;
	sectionId: string;
	sectionTitle: string;
	relevanceScore: number;
	reason: string;
}

export interface AutoLinkResult {
	successfulLinks: number;
	failedLinks: number;
	linkedRequirements: {
		requirementId: string;
		requirementNumber: string;
		linkedTo: string;
		confidence: number;
	}[];
	unlinkedRequirements: {
		requirementId: string;
		requirementNumber: string;
		reason: string;
	}[];
}

// ============================================================================
// Main Validation Functions
// ============================================================================

/**
 * Validates compliance for an opportunity, checking all requirements against
 * the compliance matrix and response documents.
 */
export async function validateCompliance(opportunityId: string): Promise<ValidationResult> {
	const userContext = await requireUserContext();

	// Get the latest compliance matrix for this opportunity
	const matrix = await db.query.complianceMatrices.findFirst({
		where: eq(complianceMatrices.opportunityId, opportunityId),
		orderBy: (matrices, { desc }) => [desc(matrices.version)],
	});

	if (!matrix) {
		return {
			isValid: false,
			coverageScore: 0,
			mandatoryCoverageScore: 0,
			totalRequirements: 0,
			mandatoryRequirements: 0,
			addressedRequirements: 0,
			issues: [{
				type: "missing",
				severity: "critical",
				requirementId: "",
				requirementNumber: "N/A",
				description: "No compliance matrix found for this opportunity",
			}],
			suggestions: [{
				requirementId: "",
				type: "add_reference",
				description: "Create a compliance matrix by uploading and parsing the RFP document",
				priority: "high",
			}],
			timestamp: new Date().toISOString(),
		};
	}

	// Get all entries for this matrix
	const entries = await db
		.select({
			entry: complianceEntries,
			requirement: rfpRequirements,
		})
		.from(complianceEntries)
		.innerJoin(rfpRequirements, eq(complianceEntries.requirementId, rfpRequirements.id))
		.where(eq(complianceEntries.matrixId, matrix.id));

	// Analyze compliance
	const issues: ComplianceIssue[] = [];
	const suggestions: ComplianceSuggestion[] = [];

	let addressedCount = 0;
	let mandatoryAddressed = 0;
	const mandatoryCount = entries.filter((e) => e.requirement.priority === "mandatory").length;

	for (const { entry, requirement } of entries) {
		const isMandatory = requirement.priority === "mandatory";

		// Check for missing/incomplete compliance
		if (entry.complianceStatus === "not_addressed" || entry.complianceStatus === "pending") {
			issues.push({
				type: "missing",
				severity: isMandatory ? "critical" : "high",
				requirementId: requirement.id,
				requirementNumber: requirement.requirementNumber,
				description: `Requirement ${requirement.requirementNumber} has not been addressed`,
				suggestion: requirement.suggestedApproach ?? undefined,
			});

			suggestions.push({
				requirementId: requirement.id,
				type: "add_reference",
				description: `Address ${isMandatory ? "mandatory " : ""}requirement ${requirement.requirementNumber}`,
				priority: isMandatory ? "high" : "medium",
			});
		} else if (entry.complianceStatus === "partial") {
			issues.push({
				type: "partial",
				severity: isMandatory ? "high" : "medium",
				requirementId: requirement.id,
				requirementNumber: requirement.requirementNumber,
				description: `Requirement ${requirement.requirementNumber} is only partially addressed`,
				location: entry.responseReference ?? undefined,
			});

			if (isMandatory) {
				suggestions.push({
					requirementId: requirement.id,
					type: "improve_coverage",
					description: `Strengthen response to mandatory requirement ${requirement.requirementNumber}`,
					priority: "high",
				});
			}

			addressedCount++;
			if (isMandatory) mandatoryAddressed++;
		} else if (entry.complianceStatus === "non_compliant") {
			issues.push({
				type: "mismatch",
				severity: isMandatory ? "critical" : "high",
				requirementId: requirement.id,
				requirementNumber: requirement.requirementNumber,
				description: `Requirement ${requirement.requirementNumber} response is non-compliant`,
				location: entry.responseReference ?? undefined,
			});
		} else if (
			entry.complianceStatus === "compliant" ||
			entry.complianceStatus === "addressed" ||
			entry.complianceStatus === "not_applicable"
		) {
			addressedCount++;
			if (isMandatory) mandatoryAddressed++;
		}

		// Check for weak responses
		if (entry.strengthAssessment === "weak" || entry.strengthAssessment === "gap") {
			issues.push({
				type: "weak",
				severity: isMandatory ? "high" : "medium",
				requirementId: requirement.id,
				requirementNumber: requirement.requirementNumber,
				description: `Response to ${requirement.requirementNumber} is assessed as ${entry.strengthAssessment}`,
				location: entry.responseReference ?? undefined,
			});

			if (entry.mitigationStrategy) {
				suggestions.push({
					requirementId: requirement.id,
					type: "improve_coverage",
					description: entry.mitigationStrategy,
					priority: isMandatory ? "high" : "medium",
				});
			}
		}
	}

	// Calculate scores
	const totalRequirements = entries.length;
	const coverageScore = totalRequirements > 0
		? Math.round((addressedCount / totalRequirements) * 100)
		: 0;
	const mandatoryCoverageScore = mandatoryCount > 0
		? Math.round((mandatoryAddressed / mandatoryCount) * 100)
		: 100;

	// Determine if valid (all mandatory requirements must be addressed)
	const isValid = mandatoryCoverageScore === 100 && !issues.some((i) => i.severity === "critical");

	return {
		isValid,
		coverageScore,
		mandatoryCoverageScore,
		totalRequirements,
		mandatoryRequirements: mandatoryCount,
		addressedRequirements: addressedCount,
		issues: issues.sort((a, b) => {
			const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
			return severityOrder[a.severity] - severityOrder[b.severity];
		}),
		suggestions: suggestions.sort((a, b) => {
			const priorityOrder = { high: 0, medium: 1, low: 2 };
			return priorityOrder[a.priority] - priorityOrder[b.priority];
		}),
		timestamp: new Date().toISOString(),
	};
}

/**
 * Validates cross-references bidirectionally - checking that all requirements
 * have responses and all response sections map to requirements.
 */
export async function validateBidirectional(matrixId: string): Promise<BidirectionalValidation> {
	await requireUserContext();

	// Get matrix with entries
	const matrix = await db.query.complianceMatrices.findFirst({
		where: eq(complianceMatrices.id, matrixId),
	});

	if (!matrix) {
		throw new Error("Compliance matrix not found");
	}

	// Get all entries
	const entries = await db
		.select({
			entry: complianceEntries,
			requirement: rfpRequirements,
		})
		.from(complianceEntries)
		.innerJoin(rfpRequirements, eq(complianceEntries.requirementId, rfpRequirements.id))
		.where(eq(complianceEntries.matrixId, matrixId));

	// Find requirements without responses
	const requirementsWithoutResponse: MissingReference[] = entries
		.filter((e) =>
			!e.entry.responseReference &&
			e.entry.complianceStatus !== "not_applicable"
		)
		.map((e) => ({
			requirementId: e.requirement.id,
			requirementNumber: e.requirement.requirementNumber,
			requirementText: e.requirement.requirementText,
			category: e.requirement.category,
			priority: e.requirement.priority,
			suggestedSections: [], // Would be populated by AI in production
		}));

	// In production, would analyze response documents to find orphaned sections
	const responsesWithoutRequirement: BidirectionalValidation["responsesWithoutRequirement"] = [];
	const orphanedCrossReferences: BidirectionalValidation["orphanedCrossReferences"] = [];

	return {
		requirementsWithoutResponse,
		responsesWithoutRequirement,
		orphanedCrossReferences,
	};
}

/**
 * Generates heat map data showing compliance coverage by category.
 */
export async function generateComplianceHeatMap(matrixId: string): Promise<HeatMapData> {
	await requireUserContext();

	// Get all entries with requirements
	const entries = await db
		.select({
			entry: complianceEntries,
			requirement: rfpRequirements,
		})
		.from(complianceEntries)
		.innerJoin(rfpRequirements, eq(complianceEntries.requirementId, rfpRequirements.id))
		.where(eq(complianceEntries.matrixId, matrixId));

	if (entries.length === 0) {
		return {
			categories: [],
			overallScore: 0,
			mandatoryScore: 0,
		};
	}

	// Group by category
	const categoryMap = new Map<string, {
		requirements: typeof entries;
		subcategories: Map<string, typeof entries>;
	}>();

	for (const entry of entries) {
		const category = entry.requirement.category;
		const subcategory = entry.requirement.subcategory ?? "General";

		if (!categoryMap.has(category)) {
			categoryMap.set(category, {
				requirements: [],
				subcategories: new Map(),
			});
		}

		const catData = categoryMap.get(category)!;
		catData.requirements.push(entry);

		if (!catData.subcategories.has(subcategory)) {
			catData.subcategories.set(subcategory, []);
		}
		catData.subcategories.get(subcategory)!.push(entry);
	}

	// Calculate metrics per category
	const isAddressed = (status: string) =>
		["compliant", "addressed", "partial", "not_applicable"].includes(status);

	const categories = Array.from(categoryMap.entries()).map(([name, data]) => {
		const total = data.requirements.length;
		const addressed = data.requirements.filter((e) => isAddressed(e.entry.complianceStatus)).length;
		const mandatory = data.requirements.filter((e) => e.requirement.priority === "mandatory");
		const mandatoryAddressed = mandatory.filter((e) => isAddressed(e.entry.complianceStatus)).length;

		const subcategories = Array.from(data.subcategories.entries()).map(([subName, subEntries]) => ({
			name: subName,
			totalRequirements: subEntries.length,
			addressedRequirements: subEntries.filter((e) => isAddressed(e.entry.complianceStatus)).length,
			complianceRate: subEntries.length > 0
				? Math.round((subEntries.filter((e) => isAddressed(e.entry.complianceStatus)).length / subEntries.length) * 100)
				: 0,
		}));

		return {
			name,
			totalRequirements: total,
			addressedRequirements: addressed,
			complianceRate: total > 0 ? Math.round((addressed / total) * 100) : 0,
			mandatoryCount: mandatory.length,
			mandatoryAddressed,
			subcategories,
		};
	});

	// Calculate overall scores
	const totalReqs = entries.length;
	const totalAddressed = entries.filter((e) => isAddressed(e.entry.complianceStatus)).length;
	const mandatoryReqs = entries.filter((e) => e.requirement.priority === "mandatory");
	const mandatoryAddressed = mandatoryReqs.filter((e) => isAddressed(e.entry.complianceStatus)).length;

	return {
		categories: categories.sort((a, b) => a.complianceRate - b.complianceRate),
		overallScore: totalReqs > 0 ? Math.round((totalAddressed / totalReqs) * 100) : 0,
		mandatoryScore: mandatoryReqs.length > 0
			? Math.round((mandatoryAddressed / mandatoryReqs.length) * 100)
			: 100,
	};
}

/**
 * Suggests locations in response documents where a requirement could be addressed.
 */
export async function suggestCrossReferenceLocations(
	requirementId: string
): Promise<SuggestedLocation[]> {
	await requireUserContext();

	const requirement = await db.query.rfpRequirements.findFirst({
		where: eq(rfpRequirements.id, requirementId),
	});

	if (!requirement) {
		throw new Error("Requirement not found");
	}

	// In production, this would use semantic search to find relevant document sections
	// For now, return empty array
	return [];
}

/**
 * Automatically links requirements to response sections using AI matching.
 */
export async function autoLinkRequirements(documentId: string): Promise<AutoLinkResult> {
	await requireUserContext();

	// In production, this would:
	// 1. Extract sections from the document
	// 2. Get all unlinked requirements
	// 3. Use semantic matching to find best matches
	// 4. Create compliance entry links above a confidence threshold

	return {
		successfulLinks: 0,
		failedLinks: 0,
		linkedRequirements: [],
		unlinkedRequirements: [],
	};
}

/**
 * Detects requirements that are missing cross-references in the response.
 */
export async function detectMissingCrossReferences(
	documentId: string
): Promise<MissingReference[]> {
	await requireUserContext();

	// Find the document and associated opportunity
	const document = await db.query.documents.findFirst({
		where: eq(documents.id, documentId),
	});

	if (!document) {
		return [];
	}

	// Extract opportunityId from document metadata if available
	const metadata = document.metadata as { opportunityId?: string } | null;
	const opportunityId = metadata?.opportunityId;

	if (!opportunityId) {
		return [];
	}

	// Get requirements for this opportunity that are not addressed
	const requirements = await db.query.rfpRequirements.findMany({
		where: and(
			eq(rfpRequirements.opportunityId, opportunityId),
			eq(rfpRequirements.complianceStatus, "not_addressed")
		),
	});

	return requirements.map((req) => ({
		requirementId: req.id,
		requirementNumber: req.requirementNumber,
		requirementText: req.requirementText,
		category: req.category,
		priority: req.priority,
		suggestedSections: [],
	}));
}

/**
 * Detects requirements that are referenced too many times (potential redundancy).
 */
export async function detectOverReferences(documentId: string): Promise<OverReference[]> {
	await requireUserContext();

	// In production, would analyze document content for cross-references
	// and identify requirements mentioned more than necessary

	return [];
}

/**
 * Exports a compliance report in the specified format.
 */
export async function exportComplianceReport(
	matrixId: string,
	format: "pdf" | "xlsx"
): Promise<{ downloadUrl: string; reportData: ComplianceReportData }> {
	await requireUserContext();

	// Fetch compliance matrix
	const matrix = await db.query.complianceMatrices.findFirst({
		where: eq(complianceMatrices.id, matrixId),
	});

	if (!matrix) {
		throw new Error("Compliance matrix not found");
	}

	// Fetch all entries with requirements
	const entries = await db
		.select({
			entry: complianceEntries,
			requirement: rfpRequirements,
		})
		.from(complianceEntries)
		.leftJoin(rfpRequirements, eq(complianceEntries.requirementId, rfpRequirements.id))
		.where(eq(complianceEntries.matrixId, matrixId));

	// Calculate scores
	const totalRequirements = entries.length;
	const mandatoryEntries = entries.filter(e => e.requirement?.priority === "mandatory");
	const addressedEntries = entries.filter(e =>
		e.entry.complianceStatus === "compliant" || e.entry.complianceStatus === "partial"
	);
	const mandatoryAddressed = mandatoryEntries.filter(e =>
		e.entry.complianceStatus === "compliant" || e.entry.complianceStatus === "partial"
	);

	const coverageScore = totalRequirements > 0
		? Math.round((addressedEntries.length / totalRequirements) * 100)
		: 0;
	const mandatoryCoverage = mandatoryEntries.length > 0
		? Math.round((mandatoryAddressed.length / mandatoryEntries.length) * 100)
		: 100;

	// Group entries by category
	const entriesBySection = entries.reduce((acc, e) => {
		const section = e.requirement?.category || "Uncategorized";
		if (!acc[section]) acc[section] = [];
		acc[section].push(e);
		return acc;
	}, {} as Record<string, typeof entries>);

	// Build report data structure
	const reportData: ComplianceReportData = {
		matrixId,
		generatedAt: new Date().toISOString(),
		summary: {
			totalRequirements,
			mandatoryRequirements: mandatoryEntries.length,
			addressedRequirements: addressedEntries.length,
			coverageScore,
			mandatoryCoverage,
			status: coverageScore >= 90 ? "excellent" : coverageScore >= 70 ? "good" : coverageScore >= 50 ? "needs_work" : "critical",
		},
		sections: Object.entries(entriesBySection).map(([sectionName, sectionEntries]) => ({
			name: sectionName,
			entries: sectionEntries.map(e => ({
				requirementNumber: e.requirement?.requirementNumber || "N/A",
				requirementText: e.requirement?.requirementText || "",
				priority: e.requirement?.priority || "optional",
				complianceStatus: e.entry.complianceStatus || "not_addressed",
				responseReference: e.entry.responseReference || "",
				notes: e.entry.notes || "",
				// Compute score from strengthAssessment: strong=100, adequate=75, weak=50, gap=0
				score: e.entry.strengthAssessment === "strong" ? 100
					: e.entry.strengthAssessment === "adequate" ? 75
					: e.entry.strengthAssessment === "weak" ? 50
					: 0,
			})),
		})),
	};

	// Generate download URL for document generation API
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const filename = `compliance-report-${matrixId.substring(0, 8)}-${timestamp}.${format}`;
	const downloadUrl = `/api/documents/generate?type=compliance-report&matrixId=${matrixId}&format=${format}&filename=${encodeURIComponent(filename)}`;

	return { downloadUrl, reportData };
}

// Type for compliance report export
interface ComplianceReportData {
	matrixId: string;
	generatedAt: string;
	summary: {
		totalRequirements: number;
		mandatoryRequirements: number;
		addressedRequirements: number;
		coverageScore: number;
		mandatoryCoverage: number;
		status: "excellent" | "good" | "needs_work" | "critical";
	};
	sections: {
		name: string;
		entries: {
			requirementNumber: string;
			requirementText: string;
			priority: string;
			complianceStatus: string;
			responseReference: string;
			notes: string;
			score: number;
		}[];
	}[];
}
