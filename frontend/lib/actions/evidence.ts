"use server";

/**
 * Evidence & Proof Point Optimizer Server Actions
 *
 * Provides comprehensive evidence management capabilities for government proposals including:
 * - Evidence library CRUD operations with search and bulk import
 * - AI-powered claim analysis to identify unsupported assertions
 * - Evidence suggestion engine for claim substantiation
 * - Evidence distribution and coverage analysis
 * - Evidence strength rating with multi-dimensional scoring
 * - Evidence matrices for evaluation criteria mapping
 * - Usage tracking and effectiveness analytics
 * - Report generation and export capabilities
 *
 * All operations are scoped to the authenticated user's organization and
 * integrate with AI services for intelligent analysis and suggestions.
 *
 * @module lib/actions/evidence
 */

import { db } from "@/lib/db";
import { eq, and, desc, asc, inArray, sql, like, or, isNull, gte, lte, count } from "drizzle-orm";
import { requireUserContext } from "@/lib/auth-utils";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
	evidenceLibrary,
	evidenceUsages,
	claimAnalysis,
	evidenceMatrices,
	evidenceStrengthAnalysis,
	type Evidence as DBEvidence,
	type EvidenceUsage as DBEvidenceUsage,
	type ClaimAnalysisRecord as DBClaimAnalysis,
	type EvidenceMatrix as DBEvidenceMatrix,
	type EvidenceStrengthAnalysisRecord as DBEvidenceStrengthAnalysis,
	type NewEvidence,
	type NewEvidenceUsage,
	type NewClaimAnalysis,
	type NewEvidenceMatrix,
	type NewEvidenceStrengthAnalysis,
	type EvidenceType,
	type EvidenceCategory,
	type EvidenceSourceType,
	type EvidenceStatus,
	type EvidenceUsageType,
	type ClaimType,
	type ClaimEvidenceStrength,
	type ClaimRiskLevel,
	type ClaimAnalysisStatus,
	type ClaimResolution,
	type EvidenceMatrixType,
	type EvidenceTier,
	type GapCriticality,
	type StrengthFactor,
	type SuggestedEvidence,
	type EvidenceMatrixRow,
	type EvidenceMatrixColumn,
	type EvidenceMatrixCell,
	type EvidenceMatrixGap,
	type StrengthImprovementSuggestion,
	type ClaimLocation,
} from "@/lib/db/schema-evidence";

// ============================================================================
// Extended Type Aliases (for component compatibility)
// ============================================================================

/**
 * Extended evidence type that includes component-used values.
 */
export type ExtendedEvidenceType =
	| EvidenceType
	| "past_performance"
	| "reference";

/**
 * Extended evidence category that includes component-used values.
 */
export type ExtendedEvidenceCategory =
	| EvidenceCategory
	| "corporate"
	| "staffing"
	| "cost"
	| "risk";

/**
 * Extended evidence source type that includes component-used values.
 */
export type ExtendedEvidenceSourceType =
	| EvidenceSourceType
	| "external";

/**
 * Extended evidence status that includes component-used values.
 */
export type ExtendedEvidenceStatus =
	| EvidenceStatus
	| "active"
	| "expired";

// ============================================================================
// Result Type Wrapper
// ============================================================================

/**
 * Standard result wrapper for server actions.
 * All server actions return this pattern for consistent error handling.
 */
export type ActionResult<T> =
	| { success: true; data: T }
	| { success: false; error: string };

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Evidence item with all fields exposed to the API layer.
 */
export interface Evidence {
	id: string;
	organizationId: string | null;
	title: string;
	content: string;
	summary: string | null;
	evidenceType: EvidenceType | null;
	category: EvidenceCategory | null;
	subcategory: string | null;
	tags: string[];
	isQuantified: boolean;
	metric: string | null;
	metricValue: string | null;
	metricUnit: string | null;
	metricContext: string | null;
	sourceType: EvidenceSourceType | null;
	sourceReference: string | null;
	sourceDate: string | null;
	sourceVerified: boolean;
	verificationNotes: string | null;
	strengthScore: number | null;
	strengthFactors: StrengthFactor[] | null;
	relatedCapabilities: string[] | null;
	relatedNaicsCodes: string[] | null;
	relatedAgencies: string[] | null;
	useCount: number;
	lastUsedAt: Date | null;
	lastUsedInOpportunityId: string | null;
	status: EvidenceStatus;
	approvedBy: string | null;
	approvedAt: Date | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating new evidence.
 * Uses extended types for component compatibility.
 */
export interface CreateEvidenceInput {
	title: string;
	content: string;
	summary?: string;
	evidenceType?: ExtendedEvidenceType;
	/** Alias for evidenceType (backward compatibility) */
	type?: ExtendedEvidenceType;
	category?: ExtendedEvidenceCategory;
	subcategory?: string;
	tags?: string[];
	isQuantified?: boolean;
	metric?: string;
	metricValue?: string;
	metricUnit?: string;
	metricContext?: string;
	sourceType?: ExtendedEvidenceSourceType;
	sourceReference?: string;
	sourceDate?: string;
	sourceVerified?: boolean;
	verificationNotes?: string;
	relatedCapabilities?: string[];
	relatedNaicsCodes?: string[];
	relatedAgencies?: string[];
	status?: ExtendedEvidenceStatus;
}

/**
 * Input for updating evidence.
 */
export interface UpdateEvidenceInput extends Partial<CreateEvidenceInput> {}

/**
 * Filters for listing and searching evidence.
 */
export interface EvidenceFilters {
	evidenceType?: ExtendedEvidenceType | ExtendedEvidenceType[];
	category?: ExtendedEvidenceCategory | ExtendedEvidenceCategory[];
	status?: ExtendedEvidenceStatus | ExtendedEvidenceStatus[];
	tags?: string[];
	isQuantified?: boolean;
	minStrengthScore?: number;
	maxStrengthScore?: number;
	search?: string;
	limit?: number;
	offset?: number;
	orderBy?: "title" | "strengthScore" | "useCount" | "createdAt" | "updatedAt";
	orderDirection?: "asc" | "desc";
}

/**
 * Search result with relevance information.
 */
export interface SearchResult {
	evidence: Evidence;
	relevanceScore: number;
	matchedFields: string[];
}

/**
 * Result from claim analysis containing all claim details.
 */
export interface ClaimAnalysisResult {
	id: string;
	claimText: string;
	claimType: ClaimType | null;
	location: {
		sectionId: string | null;
		sectionName: string | null;
		pageNumber: number | null;
	};
	hasEvidence: boolean;
	evidenceStrength: ClaimEvidenceStrength;
	linkedEvidence: { id: string; title: string; relevance: number }[];
	suggestedEvidence: { id: string; title: string; relevance: number; reason: string }[];
	riskLevel: ClaimRiskLevel | null;
	quantificationSuggestion: string | null;
}

/**
 * Resolution data for a claim.
 */
export interface ClaimResolutionInput {
	resolution: ClaimResolution;
	notes?: string;
	linkedEvidenceIds?: string[];
}

/**
 * Evidence suggestion for a claim or section.
 */
export interface EvidenceSuggestion {
	evidenceId: string;
	evidenceTitle: string;
	evidenceType: EvidenceType | null;
	relevanceScore: number;
	reason: string;
	suggestedUsage: string;
	strengthScore: number | null;
}

/**
 * Distribution analysis results.
 */
export interface DistributionAnalysis {
	totalEvidence: number;
	byType: Record<string, { count: number; percentage: number }>;
	byStrength: Record<string, { count: number; percentage: number }>;
	coverageScore: number;
	underutilized: { id: string; title: string; useCount: number }[];
	overused: { id: string; title: string; useCount: number }[];
	gaps: { category: string; currentCount: number; recommended: number }[];
}

/**
 * Coverage analysis results for an opportunity.
 */
export interface CoverageAnalysis {
	opportunityId: string;
	totalRequirements: number;
	coveredRequirements: number;
	coveragePercentage: number;
	gapsBySection: { sectionId: string; sectionName: string; missingEvidence: string[] }[];
	recommendations: string[];
}

/**
 * Evidence matrix with coverage analysis.
 */
export interface EvidenceMatrixResult {
	id: string;
	name: string | null;
	rows: EvidenceMatrixRow[];
	columns: EvidenceMatrixColumn[];
	cells: EvidenceMatrixCell[];
	overallCoverage: number | null;
	gaps: EvidenceMatrixGap[];
}

/**
 * Quantification suggestion for a claim.
 */
export interface QuantificationSuggestion {
	originalClaim: string;
	quantifiedVersions: {
		text: string;
		evidenceNeeded: string;
		strengthIncrease: number;
		dataSource?: string;
	}[];
	metrics: { name: string; unit: string; example: string }[];
}

/**
 * Strength rating with multi-dimensional analysis.
 */
export interface StrengthRating {
	overallScore: number;
	tier: EvidenceTier;
	dimensions: {
		recency: { score: number; notes: string };
		specificity: { score: number; notes: string };
		quantification: { score: number; notes: string };
		verifiability: { score: number; notes: string };
		relevance: { score: number; notes: string };
	};
	improvements: StrengthImprovementSuggestion[];
}

/**
 * Evidence usage record input.
 */
export interface EvidenceUsageInput {
	documentId: string;
	opportunityId?: string;
	sectionId?: string;
	sectionName?: string;
	usageType?: EvidenceUsageType;
	usedText?: string;
	context?: string;
}

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

// ============================================================================
// Zod Validation Schemas
// ============================================================================

// Extended Zod schemas to accept both schema values and component values
const evidenceTypeSchema = z.enum([
	"metric",
	"testimonial",
	"case_study",
	"certification",
	"award",
	"publication",
	"capability",
	"past_performance", // Extended for component compatibility
	"reference",        // Extended for component compatibility
]);

const evidenceCategorySchema = z.enum([
	"technical",
	"management",
	"past_performance",
	"cost_efficiency",
	"innovation",
	"corporate", // Extended for component compatibility
	"staffing",  // Extended for component compatibility
	"cost",      // Extended for component compatibility
	"risk",      // Extended for component compatibility
]);

const evidenceSourceTypeSchema = z.enum([
	"internal",
	"customer",
	"third_party",
	"government",
	"external", // Extended for component compatibility
]);

const evidenceStatusSchema = z.enum([
	"draft",
	"approved",
	"archived",
	"active",  // Extended for component compatibility
	"expired", // Extended for component compatibility
]);

const createEvidenceSchema = z.object({
	title: z.string().min(1, "Title is required").max(500),
	content: z.string().min(1, "Content is required"),
	summary: z.string().optional(),
	evidenceType: evidenceTypeSchema.optional(),
	category: evidenceCategorySchema.optional(),
	subcategory: z.string().max(200).optional(),
	tags: z.array(z.string()).optional().default([]),
	isQuantified: z.boolean().optional().default(false),
	metric: z.string().max(200).optional(),
	metricValue: z.string().max(100).optional(),
	metricUnit: z.string().max(50).optional(),
	metricContext: z.string().optional(),
	sourceType: evidenceSourceTypeSchema.optional(),
	sourceReference: z.string().optional(),
	sourceDate: z.string().optional(),
	sourceVerified: z.boolean().optional().default(false),
	verificationNotes: z.string().optional(),
	relatedCapabilities: z.array(z.string()).optional().default([]),
	relatedNaicsCodes: z.array(z.string()).optional().default([]),
	relatedAgencies: z.array(z.string()).optional().default([]),
	status: evidenceStatusSchema.optional().default("draft"),
});

const updateEvidenceSchema = createEvidenceSchema.partial();

const claimResolutionSchema = z.object({
	resolution: z.enum(["evidence_added", "claim_removed", "claim_modified", "accepted_as_is"]),
	notes: z.string().optional(),
	linkedEvidenceIds: z.array(z.string()).optional(),
});

const evidenceUsageInputSchema = z.object({
	documentId: z.string().uuid("Invalid document ID"),
	opportunityId: z.string().uuid("Invalid opportunity ID").optional(),
	sectionId: z.string().optional(),
	sectionName: z.string().max(300).optional(),
	usageType: z.enum(["direct_quote", "paraphrased", "supporting", "reference"]).optional(),
	usedText: z.string().optional(),
	context: z.string().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map database evidence row to API response type.
 *
 * Transforms the raw database row into a clean API response object
 * with proper type handling for nullable fields.
 *
 * @param row - Raw database evidence row
 * @returns Formatted evidence object for API responses
 */
function mapDBEvidenceToEvidence(row: DBEvidence): Evidence {
	return {
		id: row.id,
		organizationId: row.organizationId,
		title: row.title,
		content: row.content,
		summary: row.summary,
		evidenceType: row.evidenceType,
		category: row.category,
		subcategory: row.subcategory,
		tags: (row.tags as string[]) || [],
		isQuantified: row.isQuantified || false,
		metric: row.metric,
		metricValue: row.metricValue,
		metricUnit: row.metricUnit,
		metricContext: row.metricContext,
		sourceType: row.sourceType,
		sourceReference: row.sourceReference,
		sourceDate: row.sourceDate,
		sourceVerified: row.sourceVerified || false,
		verificationNotes: row.verificationNotes,
		strengthScore: row.strengthScore,
		strengthFactors: row.strengthFactors,
		relatedCapabilities: row.relatedCapabilities,
		relatedNaicsCodes: row.relatedNaicsCodes,
		relatedAgencies: row.relatedAgencies,
		useCount: row.useCount || 0,
		lastUsedAt: row.lastUsedAt,
		lastUsedInOpportunityId: row.lastUsedInOpportunityId,
		status: row.status || "draft",
		approvedBy: row.approvedBy,
		approvedAt: row.approvedAt,
		createdBy: row.createdBy,
		createdAt: row.createdAt || new Date(),
		updatedAt: row.updatedAt || new Date(),
	};
}

/**
 * Map database claim analysis row to API response type.
 *
 * Transforms raw claim data and linked evidence into a structured
 * claim analysis result for the API.
 *
 * @param row - Raw database claim analysis row
 * @param linkedEvidence - Array of linked evidence with relevance scores
 * @returns Formatted claim analysis result
 */
function mapDBClaimToClaimAnalysis(
	row: DBClaimAnalysis,
	linkedEvidence: { id: string; title: string; relevance: number }[] = []
): ClaimAnalysisResult {
	const suggestedEvidence = (row.suggestedEvidence as SuggestedEvidence[]) || [];
	const location = row.claimLocation as ClaimLocation | null;

	return {
		id: row.id,
		claimText: row.claimText,
		claimType: row.claimType,
		location: {
			sectionId: row.sectionId,
			sectionName: null,
			pageNumber: location?.pageNumber ?? null,
		},
		hasEvidence: row.hasEvidence || false,
		evidenceStrength: row.evidenceStrength || "none",
		linkedEvidence,
		suggestedEvidence: suggestedEvidence.map((s) => ({
			id: s.evidenceId,
			title: "",
			relevance: s.relevance * 100,
			reason: s.reason,
		})),
		riskLevel: row.riskLevel,
		quantificationSuggestion: row.quantificationSuggestion,
	};
}

/**
 * Calculate evidence strength tier from numeric score.
 *
 * Gold tier: 80-100 (highly compelling, verifiable, quantified)
 * Silver tier: 60-79 (strong evidence with good specificity)
 * Bronze tier: 0-59 (acceptable evidence that could be strengthened)
 *
 * @param score - Numeric strength score (0-100)
 * @returns Evidence tier classification
 */
function calculateTier(score: number): EvidenceTier {
	if (score >= 80) return "gold";
	if (score >= 60) return "silver";
	return "bronze";
}

/**
 * Calculate initial strength score based on evidence attributes.
 *
 * Evaluates multiple factors including quantification, source verification,
 * content detail level, and capability associations to produce a base score.
 *
 * @param data - Evidence input data to analyze
 * @returns Initial strength score (0-100)
 */
function calculateInitialStrengthScore(data: CreateEvidenceInput): number {
	let score = 50; // Base score

	// Quantification bonus (+15 base, +10 with context)
	if (data.isQuantified && data.metric && data.metricValue) {
		score += 15;
		if (data.metricContext) {
			score += 10;
		}
	}

	// Source verification bonus
	if (data.sourceType) {
		score += 10;
		if (data.sourceType === "customer" || data.sourceType === "third_party") {
			score += 5;
		}
		if (data.sourceVerified) {
			score += 5;
		}
	}

	// Content length bonus (detailed evidence)
	if (data.content && data.content.length > 500) {
		score += 5;
	}

	// Related capabilities bonus
	if (data.relatedCapabilities && data.relatedCapabilities.length > 0) {
		score += 5;
	}

	return Math.min(100, Math.max(0, score));
}

// ============================================================================
// Evidence Library CRUD Operations
// ============================================================================

/**
 * Create a new evidence item in the library.
 *
 * Creates a new evidence entry with the provided details and associates it
 * with the current user's organization. The evidence starts in draft status
 * unless otherwise specified. An initial strength score is calculated based
 * on the provided attributes.
 *
 * @param data - Evidence creation data including title, content, and metadata
 * @returns Created evidence item with generated ID and computed fields
 *
 * @example
 * ```typescript
 * const evidence = await createEvidence({
 *   title: "Cloud Migration Success",
 *   content: "Successfully migrated 500+ applications to AWS with 99.9% uptime",
 *   evidenceType: "metric",
 *   category: "technical",
 *   isQuantified: true,
 *   metric: "uptime",
 *   metricValue: "99.9",
 *   metricUnit: "%"
 * });
 * ```
 */
export async function createEvidence(data: CreateEvidenceInput): Promise<ActionResult<Evidence>> {
	try {
		const userContext = await requireUserContext();

		if (!userContext.organizationId) {
			return { success: false, error: "Organization context required to create evidence" };
		}

		const validated = createEvidenceSchema.parse(data);

		// Calculate initial strength score
		const strengthScore = calculateInitialStrengthScore(validated);

		const [evidence] = await db
			.insert(evidenceLibrary)
			.values({
				organizationId: userContext.organizationId as string,
				title: validated.title,
				content: validated.content,
				summary: validated.summary,
				evidenceType: validated.evidenceType as EvidenceType | undefined,
				category: validated.category as EvidenceCategory | undefined,
				subcategory: validated.subcategory,
				tags: validated.tags,
				isQuantified: validated.isQuantified,
				metric: validated.metric,
				metricValue: validated.metricValue,
				metricUnit: validated.metricUnit,
				metricContext: validated.metricContext,
				sourceType: validated.sourceType as EvidenceSourceType | undefined,
				sourceReference: validated.sourceReference,
				sourceDate: validated.sourceDate,
				sourceVerified: validated.sourceVerified,
				verificationNotes: validated.verificationNotes,
				relatedCapabilities: validated.relatedCapabilities,
				relatedNaicsCodes: validated.relatedNaicsCodes,
				relatedAgencies: validated.relatedAgencies,
				status: validated.status as EvidenceStatus | undefined,
				strengthScore,
				createdBy: userContext.userId,
			})
			.returning();

		revalidatePath("/evidence");

		return { success: true, data: mapDBEvidenceToEvidence(evidence) };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map(i => i.message).join(", ") };
		}
		return { success: false, error: `Failed to create evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Update an existing evidence item.
 *
 * Updates the specified fields of an evidence item. Only the fields
 * provided in the input will be updated; others remain unchanged.
 * If strength-relevant fields are modified, the strength score is
 * recalculated.
 *
 * @param id - Evidence ID to update
 * @param data - Fields to update
 * @returns Updated evidence item
 *
 * @throws Error if evidence not found
 */
export async function updateEvidence(id: string, data: UpdateEvidenceInput): Promise<ActionResult<Evidence>> {
	try {
		await requireUserContext();
		const validated = updateEvidenceSchema.parse(data);

		// Build update object with only provided fields
		const updates: Partial<NewEvidence> = {
			updatedAt: new Date(),
		};

		if (validated.title !== undefined) updates.title = validated.title;
		if (validated.content !== undefined) updates.content = validated.content;
		if (validated.summary !== undefined) updates.summary = validated.summary;
		if (validated.evidenceType !== undefined) updates.evidenceType = validated.evidenceType as EvidenceType;
		if (validated.category !== undefined) updates.category = validated.category as EvidenceCategory;
		if (validated.subcategory !== undefined) updates.subcategory = validated.subcategory;
		if (validated.tags !== undefined) updates.tags = validated.tags;
		if (validated.isQuantified !== undefined) updates.isQuantified = validated.isQuantified;
		if (validated.metric !== undefined) updates.metric = validated.metric;
		if (validated.metricValue !== undefined) updates.metricValue = validated.metricValue;
		if (validated.metricUnit !== undefined) updates.metricUnit = validated.metricUnit;
		if (validated.metricContext !== undefined) updates.metricContext = validated.metricContext;
		if (validated.sourceType !== undefined) updates.sourceType = validated.sourceType as EvidenceSourceType;
		if (validated.sourceReference !== undefined) updates.sourceReference = validated.sourceReference;
		if (validated.sourceDate !== undefined) updates.sourceDate = validated.sourceDate;
		if (validated.sourceVerified !== undefined) updates.sourceVerified = validated.sourceVerified;
		if (validated.verificationNotes !== undefined) updates.verificationNotes = validated.verificationNotes;
		if (validated.relatedCapabilities !== undefined) updates.relatedCapabilities = validated.relatedCapabilities;
		if (validated.relatedNaicsCodes !== undefined) updates.relatedNaicsCodes = validated.relatedNaicsCodes;
		if (validated.relatedAgencies !== undefined) updates.relatedAgencies = validated.relatedAgencies;
		if (validated.status !== undefined) updates.status = validated.status as EvidenceStatus;

		const [evidence] = await db.update(evidenceLibrary).set(updates).where(eq(evidenceLibrary.id, id)).returning();

		if (!evidence) {
			return { success: false, error: "Evidence not found" };
		}

		revalidatePath("/evidence");
		revalidatePath(`/evidence/${id}`);

		return { success: true, data: mapDBEvidenceToEvidence(evidence) };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map(i => i.message).join(", ") };
		}
		return { success: false, error: `Failed to update evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Delete an evidence item from the library.
 *
 * Permanently removes the evidence item and all associated usage records
 * through cascading deletes. This action cannot be undone.
 *
 * @param id - Evidence ID to delete
 *
 * @throws Error if evidence not found
 */
export async function deleteEvidence(id: string): Promise<ActionResult<{ deleted: boolean }>> {
	try {
		await requireUserContext();

		const result = await db.delete(evidenceLibrary).where(eq(evidenceLibrary.id, id));

		if (result.rowCount === 0) {
			return { success: false, error: "Evidence not found" };
		}

		revalidatePath("/evidence");
		return { success: true, data: { deleted: true } };
	} catch (error) {
		return { success: false, error: `Failed to delete evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Get a single evidence item by ID.
 *
 * Retrieves the full details of an evidence item including all metadata,
 * strength scores, and related information.
 *
 * @param id - Evidence ID to retrieve
 * @returns Evidence item or null if not found
 */
export async function getEvidence(id: string): Promise<ActionResult<Evidence>> {
	try {
		await requireUserContext();

		const [evidence] = await db.select().from(evidenceLibrary).where(eq(evidenceLibrary.id, id));

		if (!evidence) {
			return { success: false, error: "Evidence not found" };
		}

		return { success: true, data: mapDBEvidenceToEvidence(evidence) };
	} catch (error) {
		return { success: false, error: `Failed to get evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * List evidence items with optional filtering.
 *
 * Retrieves a paginated list of evidence items matching the specified filters.
 * Supports filtering by type, category, status, tags, and strength score range.
 * Results can be sorted by various fields in ascending or descending order.
 *
 * @param filters - Optional filters to apply including type, category, status, tags
 * @returns Array of evidence items matching filters
 *
 * @example
 * ```typescript
 * const technicalEvidence = await listEvidence({
 *   category: "technical",
 *   status: "approved",
 *   minStrengthScore: 70,
 *   orderBy: "strengthScore",
 *   orderDirection: "desc",
 *   limit: 20
 * });
 * ```
 */
export async function listEvidence(filters?: EvidenceFilters): Promise<ActionResult<Evidence[]>> {
	try {
		const userContext = await requireUserContext();

	// Build query conditions
	const conditions = [];

	// Organization scope - allow org evidence and shared (null org) evidence
	if (userContext.organizationId) {
		conditions.push(
			or(eq(evidenceLibrary.organizationId, userContext.organizationId), isNull(evidenceLibrary.organizationId))
		);
	}

	// Type filter
	if (filters?.evidenceType) {
		const types = Array.isArray(filters.evidenceType) ? filters.evidenceType : [filters.evidenceType];
		conditions.push(inArray(evidenceLibrary.evidenceType, types as EvidenceType[]));
	}

	// Category filter
	if (filters?.category) {
		const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
		conditions.push(inArray(evidenceLibrary.category, categories as EvidenceCategory[]));
	}

	// Status filter
	if (filters?.status) {
		const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
		conditions.push(inArray(evidenceLibrary.status, statuses as EvidenceStatus[]));
	}

	// Quantified filter
	if (filters?.isQuantified !== undefined) {
		conditions.push(eq(evidenceLibrary.isQuantified, filters.isQuantified));
	}

	// Strength score range
	if (filters?.minStrengthScore !== undefined) {
		conditions.push(gte(evidenceLibrary.strengthScore, filters.minStrengthScore));
	}
	if (filters?.maxStrengthScore !== undefined) {
		conditions.push(lte(evidenceLibrary.strengthScore, filters.maxStrengthScore));
	}

	// Text search across title, content, summary
	if (filters?.search) {
		const searchTerm = `%${filters.search}%`;
		conditions.push(
			or(
				like(evidenceLibrary.title, searchTerm),
				like(evidenceLibrary.content, searchTerm),
				sql`${evidenceLibrary.summary} ILIKE ${searchTerm}`
			)
		);
	}

	// Determine sort order
	const orderField = filters?.orderBy || "createdAt";
	const orderDirection = filters?.orderDirection || "desc";

	// Map field names to actual columns
	const fieldMap: Record<string, ReturnType<typeof asc>> = {
		title: orderDirection === "asc" ? asc(evidenceLibrary.title) : desc(evidenceLibrary.title),
		strengthScore:
			orderDirection === "asc" ? asc(evidenceLibrary.strengthScore) : desc(evidenceLibrary.strengthScore),
		useCount: orderDirection === "asc" ? asc(evidenceLibrary.useCount) : desc(evidenceLibrary.useCount),
		createdAt: orderDirection === "asc" ? asc(evidenceLibrary.createdAt) : desc(evidenceLibrary.createdAt),
		updatedAt: orderDirection === "asc" ? asc(evidenceLibrary.updatedAt) : desc(evidenceLibrary.updatedAt),
	};

	const orderClause = fieldMap[orderField] || desc(evidenceLibrary.createdAt);

		// Execute query
		const results = await db
			.select()
			.from(evidenceLibrary)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(orderClause)
			.limit(filters?.limit || 100)
			.offset(filters?.offset || 0);

		return { success: true, data: results.map(mapDBEvidenceToEvidence) };
	} catch (error) {
		return { success: false, error: `Failed to list evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Search evidence with relevance scoring.
 *
 * Performs a text search across evidence items and returns results
 * ranked by relevance to the query. Relevance is calculated based on
 * matches in title (highest weight), content, summary, tags, and metrics.
 * Strength scores provide an additional boost to high-quality evidence.
 *
 * @param query - Search query string
 * @param filters - Optional additional filters to narrow results
 * @returns Array of search results with evidence and relevance scores
 *
 * @example
 * ```typescript
 * const results = await searchEvidence("cloud migration", {
 *   category: "technical",
 *   minStrengthScore: 60
 * });
 * // Returns evidence sorted by relevance with match information
 * ```
 */
export async function searchEvidence(query: string, filters?: EvidenceFilters): Promise<ActionResult<SearchResult[]>> {
	try {
		await requireUserContext();

		// Get all evidence that matches basic filters
		const listResult = await listEvidence({
			...filters,
			search: query,
			limit: filters?.limit || 50,
		});

		if (!listResult.success) {
			return { success: false, error: listResult.error };
		}

		const baseEvidence = listResult.data;

		// Calculate relevance scores for each result
		const results: SearchResult[] = [];
		const queryLower = query.toLowerCase();

		for (const evidence of baseEvidence) {
			const matchedFields: string[] = [];
			let relevanceScore = 0;

			// Title match (highest weight - 40 points)
			if (evidence.title.toLowerCase().includes(queryLower)) {
				matchedFields.push("title");
				relevanceScore += 40;
			}

			// Content match (30 points)
			if (evidence.content.toLowerCase().includes(queryLower)) {
				matchedFields.push("content");
				relevanceScore += 30;
			}

			// Summary match (15 points)
			if (evidence.summary?.toLowerCase().includes(queryLower)) {
				matchedFields.push("summary");
				relevanceScore += 15;
			}

			// Tags match (10 points)
			if (evidence.tags.some((tag) => tag.toLowerCase().includes(queryLower))) {
				matchedFields.push("tags");
				relevanceScore += 10;
			}

			// Metric match (5 points)
			if (evidence.metric?.toLowerCase().includes(queryLower)) {
				matchedFields.push("metric");
				relevanceScore += 5;
			}

			// Boost by strength score (up to 10 additional points)
			if (evidence.strengthScore) {
				relevanceScore += evidence.strengthScore * 0.1;
			}

			if (matchedFields.length > 0) {
				results.push({
					evidence,
					relevanceScore: Math.min(100, relevanceScore),
					matchedFields,
				});
			}
		}

		// Sort by relevance score descending
		results.sort((a, b) => b.relevanceScore - a.relevanceScore);

		return { success: true, data: results };
	} catch (error) {
		return { success: false, error: `Failed to search evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Bulk import evidence items.
 *
 * Imports multiple evidence items in a single operation, validating each
 * and tracking successes and failures. Each item is independently processed
 * so failures in one item do not affect others.
 *
 * @param items - Array of evidence items to import
 * @returns Import results with count of imported items and error details
 *
 * @example
 * ```typescript
 * const result = await bulkImportEvidence([
 *   { title: "Evidence 1", content: "...", evidenceType: "metric" },
 *   { title: "Evidence 2", content: "...", evidenceType: "testimonial" },
 * ]);
 * console.log(`Imported ${result.imported}, Errors: ${result.errors.length}`);
 * ```
 */
export async function bulkImportEvidence(
	items: CreateEvidenceInput[]
): Promise<ActionResult<{ imported: number; errors: string[] }>> {
	try {
		const userContext = await requireUserContext();
		if (!userContext.organizationId) {
			return { success: false, error: "Organization context required to import evidence" };
		}

		const errors: string[] = [];
		let imported = 0;

		for (let i = 0; i < items.length; i++) {
			try {
				const validated = createEvidenceSchema.parse(items[i]);
				const strengthScore = calculateInitialStrengthScore(validated);

				await db.insert(evidenceLibrary).values({
					organizationId: userContext.organizationId as string,
					title: validated.title,
					content: validated.content,
					summary: validated.summary,
					evidenceType: validated.evidenceType as EvidenceType | undefined,
					category: validated.category as EvidenceCategory | undefined,
					subcategory: validated.subcategory,
					tags: validated.tags,
					isQuantified: validated.isQuantified,
					metric: validated.metric,
					metricValue: validated.metricValue,
					metricUnit: validated.metricUnit,
					metricContext: validated.metricContext,
					sourceType: validated.sourceType as EvidenceSourceType | undefined,
					sourceReference: validated.sourceReference,
					sourceDate: validated.sourceDate,
					sourceVerified: validated.sourceVerified,
					verificationNotes: validated.verificationNotes,
					relatedCapabilities: validated.relatedCapabilities,
					relatedNaicsCodes: validated.relatedNaicsCodes,
					relatedAgencies: validated.relatedAgencies,
					status: validated.status as EvidenceStatus | undefined,
					strengthScore,
					createdBy: userContext.userId,
				});

				imported++;
			} catch (error) {
				const message =
					error instanceof z.ZodError
						? error.issues.map((issue) => issue.message).join(", ")
						: error instanceof Error
							? error.message
							: "Unknown error";
				errors.push(`Item ${i + 1}: ${message}`);
			}
		}

		revalidatePath("/evidence");

		return { success: true, data: { imported, errors } };
	} catch (error) {
		return { success: false, error: `Failed to bulk import: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Claim Analysis Operations
// ============================================================================

/**
 * Analyze claims in a document to identify unsupported assertions.
 *
 * Retrieves all previously analyzed claims for a document. In a full
 * implementation, this would trigger AI analysis to scan document content,
 * identify claims, and match them against the evidence library.
 *
 * @param documentId - Document ID to analyze
 * @returns Array of claim analysis results with evidence suggestions
 *
 * @example
 * ```typescript
 * const claims = await analyzeClaimsInDocument(documentId);
 * const highRiskClaims = claims.filter(c => c.riskLevel === 'high');
 * console.log(`Found ${highRiskClaims.length} high-risk unsupported claims`);
 * ```
 */
export async function analyzeClaimsInDocument(documentId: string): Promise<ActionResult<ClaimAnalysisResult[]>> {
	try {
		await requireUserContext();

		// Get existing claims for this document
		const existingClaims = await db
			.select()
			.from(claimAnalysis)
			.where(eq(claimAnalysis.documentId, documentId))
			.orderBy(desc(claimAnalysis.analyzedAt));

		// Map to API format with linked evidence details
		const results: ClaimAnalysisResult[] = [];

		for (const claim of existingClaims) {
			// Get linked evidence details if any
			const linkedIds = (claim.linkedEvidenceIds as string[]) || [];
			const linkedEvidence: { id: string; title: string; relevance: number }[] = [];

			if (linkedIds.length > 0) {
				const evidenceItems = await db
					.select()
					.from(evidenceLibrary)
					.where(inArray(evidenceLibrary.id, linkedIds));

				linkedEvidence.push(
					...evidenceItems.map((e) => ({
						id: e.id,
						title: e.title,
						relevance: 80, // Default relevance for linked evidence
					}))
				);
			}

			results.push(mapDBClaimToClaimAnalysis(claim, linkedEvidence));
		}

		return { success: true, data: results };
	} catch (error) {
		return { success: false, error: `Failed to analyze document claims: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Analyze claims in a specific document section.
 *
 * Performs claim analysis scoped to a single section of the document.
 * Useful for targeted review of specific proposal areas without analyzing
 * the entire document.
 *
 * @param sectionId - Section ID to analyze
 * @returns Array of claim analysis results for the section
 */
export async function analyzeClaimsInSection(sectionId: string): Promise<ActionResult<ClaimAnalysisResult[]>> {
	try {
		await requireUserContext();

		const claims = await db.select().from(claimAnalysis).where(eq(claimAnalysis.sectionId, sectionId));

		const results: ClaimAnalysisResult[] = [];

		for (const claim of claims) {
			const linkedIds = (claim.linkedEvidenceIds as string[]) || [];
			const linkedEvidence: { id: string; title: string; relevance: number }[] = [];

			if (linkedIds.length > 0) {
				const evidenceItems = await db
					.select()
					.from(evidenceLibrary)
					.where(inArray(evidenceLibrary.id, linkedIds));

				linkedEvidence.push(
					...evidenceItems.map((e) => ({
						id: e.id,
						title: e.title,
						relevance: 80,
					}))
				);
			}

			results.push(mapDBClaimToClaimAnalysis(claim, linkedEvidence));
		}

		return { success: true, data: results };
	} catch (error) {
		return { success: false, error: `Failed to analyze section claims: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Get a single claim analysis by ID.
 *
 * Retrieves the full details of a claim analysis including all linked
 * evidence and suggested evidence items.
 *
 * @param claimId - Claim analysis ID
 * @returns Claim analysis result or null if not found
 */
export async function getClaimAnalysis(claimId: string): Promise<ActionResult<ClaimAnalysisResult>> {
	try {
		await requireUserContext();

		const [claim] = await db.select().from(claimAnalysis).where(eq(claimAnalysis.id, claimId));

		if (!claim) {
			return { success: false, error: "Claim not found" };
		}

		const linkedIds = (claim.linkedEvidenceIds as string[]) || [];
		const linkedEvidence: { id: string; title: string; relevance: number }[] = [];

		if (linkedIds.length > 0) {
			const evidenceItems = await db.select().from(evidenceLibrary).where(inArray(evidenceLibrary.id, linkedIds));

			linkedEvidence.push(
				...evidenceItems.map((e) => ({
					id: e.id,
					title: e.title,
					relevance: 80,
				}))
			);
		}

		return { success: true, data: mapDBClaimToClaimAnalysis(claim, linkedEvidence) };
	} catch (error) {
		return { success: false, error: `Failed to get claim analysis: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Resolve a claim with the specified resolution approach.
 *
 * Updates the claim status to resolved and records the resolution approach.
 * Can optionally include linked evidence IDs if evidence was added to
 * support the claim.
 *
 * @param claimId - Claim ID to resolve
 * @param resolution - Resolution data including approach, notes, and evidence IDs
 *
 * @throws Error if claim not found
 */
export async function resolveClaim(claimId: string, resolution: ClaimResolutionInput): Promise<ActionResult<{ resolved: boolean }>> {
	try {
		const userContext = await requireUserContext();
		const validated = claimResolutionSchema.parse(resolution);

		const updates: Partial<NewClaimAnalysis> = {
			status: "resolved",
			resolution: validated.resolution,
			resolutionNotes: validated.notes,
			resolvedBy: userContext.userId,
			resolvedAt: new Date(),
		};

		// If evidence was linked, update the claim's evidence state
		if (validated.linkedEvidenceIds?.length) {
			updates.linkedEvidenceIds = validated.linkedEvidenceIds;
			updates.hasEvidence = true;
			updates.evidenceStrength = "moderate";
		}

		const result = await db.update(claimAnalysis).set(updates).where(eq(claimAnalysis.id, claimId));

		if (result.rowCount === 0) {
			return { success: false, error: "Claim not found" };
		}

		revalidatePath("/claims");
		return { success: true, data: { resolved: true } };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map(i => i.message).join(", ") };
		}
		return { success: false, error: `Failed to resolve claim: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Link evidence to a claim.
 *
 * Associates an evidence item with a claim to substantiate it.
 * Automatically updates the claim's evidence strength based on
 * the number of linked evidence items.
 *
 * @param claimId - Claim ID to link evidence to
 * @param evidenceId - Evidence ID to link
 *
 * @throws Error if claim or evidence not found
 */
export async function linkEvidenceToClaim(claimId: string, evidenceId: string): Promise<ActionResult<{ linked: boolean }>> {
	try {
		await requireUserContext();

		// Get current claim
		const [claim] = await db.select().from(claimAnalysis).where(eq(claimAnalysis.id, claimId));

		if (!claim) {
			return { success: false, error: "Claim not found" };
		}

		// Verify evidence exists
		const [evidence] = await db.select().from(evidenceLibrary).where(eq(evidenceLibrary.id, evidenceId));

		if (!evidence) {
			return { success: false, error: "Evidence not found" };
		}

		// Update linked evidence array
		const currentLinks = (claim.linkedEvidenceIds as string[]) || [];
		if (!currentLinks.includes(evidenceId)) {
			const newLinks = [...currentLinks, evidenceId];

			// Calculate evidence strength based on number of links
			const evidenceStrength: ClaimEvidenceStrength =
				newLinks.length >= 3 ? "strong" : newLinks.length >= 1 ? "moderate" : "weak";

			await db
				.update(claimAnalysis)
				.set({
					linkedEvidenceIds: newLinks,
					hasEvidence: true,
					evidenceStrength,
				})
				.where(eq(claimAnalysis.id, claimId));
		}

		revalidatePath("/claims");
		return { success: true, data: { linked: true } };
	} catch (error) {
		return { success: false, error: `Failed to link evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Evidence Suggestions
// ============================================================================

/**
 * Suggest evidence items that could support a specific claim.
 *
 * Searches the evidence library for items that are semantically relevant
 * to the claim text. In a full implementation, this would use AI embeddings
 * for semantic matching. Currently uses keyword matching as a baseline.
 *
 * @param claimId - Claim ID to find evidence for
 * @returns Array of evidence suggestions with relevance scores
 *
 * @example
 * ```typescript
 * const suggestions = await suggestEvidenceForClaim(claimId);
 * // Shows top evidence that could support this claim
 * suggestions.forEach(s => {
 *   console.log(`${s.evidenceTitle}: ${s.relevanceScore}% - ${s.reason}`);
 * });
 * ```
 */
export async function suggestEvidenceForClaim(claimId: string): Promise<ActionResult<EvidenceSuggestion[]>> {
	try {
		await requireUserContext();

		// Get the claim
		const [claim] = await db.select().from(claimAnalysis).where(eq(claimAnalysis.id, claimId));

		if (!claim) {
			return { success: true, data: [] };
		}

		// Get approved evidence from library
		const allEvidence = await db
			.select()
			.from(evidenceLibrary)
			.where(eq(evidenceLibrary.status, "approved"))
			.limit(100);

		if (allEvidence.length === 0) {
			return { success: true, data: [] };
		}

		// Simple keyword matching for relevance scoring
		// In production, this would use AI/embeddings for semantic matching
		const claimWords = claim.claimText.toLowerCase().split(/\s+/);
		const suggestions: EvidenceSuggestion[] = [];

		for (const evidence of allEvidence) {
			const contentLower = evidence.content.toLowerCase();
			const titleLower = evidence.title.toLowerCase();

			// Calculate match score based on keyword overlap
			let matchCount = 0;
			const matchedWords: string[] = [];

			for (const word of claimWords) {
				if (word.length > 3 && (contentLower.includes(word) || titleLower.includes(word))) {
					matchCount++;
					matchedWords.push(word);
				}
			}

			const relevanceScore = Math.min(100, (matchCount / Math.max(1, claimWords.length)) * 100 + 20);

			// Only include if relevance is above threshold
			if (relevanceScore >= 40 && matchedWords.length > 0) {
				suggestions.push({
					evidenceId: evidence.id,
					evidenceTitle: evidence.title,
					evidenceType: evidence.evidenceType,
					relevanceScore: Math.round(relevanceScore),
					reason: `Matches keywords: ${matchedWords.slice(0, 5).join(", ")}`,
					suggestedUsage: evidence.summary || evidence.content.substring(0, 200),
					strengthScore: evidence.strengthScore,
				});
			}
		}

		// Sort by relevance and return top results
		return { success: true, data: suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10) };
	} catch (error) {
		return { success: false, error: `Failed to suggest evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Suggest evidence for a document section.
 *
 * Analyzes all claims in a section and aggregates evidence suggestions,
 * deduplicating across claims to provide a consolidated list.
 *
 * @param sectionId - Section ID to suggest evidence for
 * @returns Array of evidence suggestions for the entire section
 */
export async function suggestEvidenceForSection(sectionId: string): Promise<ActionResult<EvidenceSuggestion[]>> {
	try {
		await requireUserContext();

		// Get claims in this section
		const claims = await db.select().from(claimAnalysis).where(eq(claimAnalysis.sectionId, sectionId));

		// Aggregate suggestions from all claims
		const allSuggestions: EvidenceSuggestion[] = [];
		const seenEvidenceIds = new Set<string>();

		for (const claim of claims) {
			const suggestResult = await suggestEvidenceForClaim(claim.id);
			if (suggestResult.success) {
				for (const suggestion of suggestResult.data) {
					if (!seenEvidenceIds.has(suggestion.evidenceId)) {
						seenEvidenceIds.add(suggestion.evidenceId);
						allSuggestions.push(suggestion);
					}
				}
			}
		}

		// Sort by relevance and return top results
		return { success: true, data: allSuggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10) };
	} catch (error) {
		return { success: false, error: `Failed to suggest evidence for section: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Suggest evidence for evaluation criteria.
 *
 * Finds evidence that could address specific RFP evaluation criteria,
 * helping ensure comprehensive coverage of scored requirements.
 *
 * @param criteriaId - Evaluation criteria ID
 * @returns Array of evidence suggestions tailored to the criteria
 */
export async function suggestEvidenceForCriteria(criteriaId: string): Promise<ActionResult<EvidenceSuggestion[]>> {
	try {
		await requireUserContext();

		// Get approved evidence with high strength scores
		const allEvidence = await db
			.select()
			.from(evidenceLibrary)
			.where(and(eq(evidenceLibrary.status, "approved"), gte(evidenceLibrary.strengthScore, 60)))
			.orderBy(desc(evidenceLibrary.strengthScore))
			.limit(20);

		// Return as suggestions
		const suggestions = allEvidence.map((e) => ({
			evidenceId: e.id,
			evidenceTitle: e.title,
			evidenceType: e.evidenceType,
			relevanceScore: e.strengthScore || 50,
			reason: `Strong ${e.evidenceType || "evidence"} that may address evaluation criteria`,
			suggestedUsage: e.summary || e.content.substring(0, 200),
			strengthScore: e.strengthScore,
		}));
		return { success: true, data: suggestions };
	} catch (error) {
		return { success: false, error: `Failed to suggest evidence for criteria: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Evidence Distribution & Coverage
// ============================================================================

/**
 * Calculate evidence distribution for a document.
 *
 * Analyzes how evidence is distributed across a proposal document,
 * identifying patterns, gaps, and imbalances in evidence usage. Useful
 * for ensuring balanced coverage of proof points.
 *
 * @param documentId - Document ID to analyze
 * @returns Distribution analysis with statistics and recommendations
 *
 * @example
 * ```typescript
 * const dist = await calculateEvidenceDistribution(documentId);
 * if (dist.gaps.length > 0) {
 *   console.log("Evidence gaps found:", dist.gaps);
 * }
 * ```
 */
export async function calculateEvidenceDistribution(documentId: string): Promise<ActionResult<DistributionAnalysis>> {
	try {
		await requireUserContext();

		// Get all evidence used in this document
		const usages = await db.select().from(evidenceUsages).where(eq(evidenceUsages.documentId, documentId));

	const evidenceIds = [...new Set(usages.map((u) => u.evidenceId))];

	// Get evidence details
	const evidenceItems =
		evidenceIds.length > 0 ? await db.select().from(evidenceLibrary).where(inArray(evidenceLibrary.id, evidenceIds)) : [];

	// Calculate distribution by type
	const byType: Record<string, { count: number; percentage: number }> = {};
	const byStrength: Record<string, { count: number; percentage: number }> = {};

	for (const ev of evidenceItems) {
		const type = ev.evidenceType || "unknown";
		byType[type] = byType[type] || { count: 0, percentage: 0 };
		byType[type].count++;

		const tier = ev.strengthScore ? calculateTier(ev.strengthScore) : "bronze";
		byStrength[tier] = byStrength[tier] || { count: 0, percentage: 0 };
		byStrength[tier].count++;
	}

	// Calculate percentages
	const total = evidenceItems.length || 1;
	for (const type of Object.keys(byType)) {
		byType[type].percentage = Math.round((byType[type].count / total) * 100);
	}
	for (const tier of Object.keys(byStrength)) {
		byStrength[tier].percentage = Math.round((byStrength[tier].count / total) * 100);
	}

	// Identify underutilized and overused evidence
	const usageCounts = new Map<string, number>();
	for (const usage of usages) {
		usageCounts.set(usage.evidenceId, (usageCounts.get(usage.evidenceId) || 0) + 1);
	}

	const avgUsage = usages.length / (evidenceItems.length || 1);

	const underutilized = evidenceItems
		.filter((e) => (usageCounts.get(e.id) || 0) < avgUsage * 0.5)
		.map((e) => ({ id: e.id, title: e.title, useCount: usageCounts.get(e.id) || 0 }));

	const overused = evidenceItems
		.filter((e) => (usageCounts.get(e.id) || 0) > avgUsage * 2)
		.map((e) => ({ id: e.id, title: e.title, useCount: usageCounts.get(e.id) || 0 }));

	// Identify gaps in evidence categories
	const gaps: { category: string; currentCount: number; recommended: number }[] = [];
	const categories: EvidenceCategory[] = ["technical", "management", "past_performance", "cost_efficiency", "innovation"];

	for (const category of categories) {
		const categoryCount = evidenceItems.filter((e) => e.category === category).length;
		const recommended = Math.max(3, Math.ceil(total * 0.2)); // At least 3 or 20% of total
		if (categoryCount < recommended) {
			gaps.push({ category, currentCount: categoryCount, recommended });
		}
	}

		// Calculate overall coverage score
		const coverageScore = Math.min(100, Math.round((evidenceItems.length / 10) * 100)); // Target: 10 pieces

		return {
			success: true,
			data: {
				totalEvidence: evidenceItems.length,
				byType,
				byStrength,
				coverageScore,
				underutilized,
				overused,
				gaps,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to calculate distribution: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Calculate evidence coverage for an opportunity.
 *
 * Analyzes how well the evidence library covers the requirements
 * and claims for a specific opportunity, identifying gaps that need
 * to be addressed before submission.
 *
 * @param opportunityId - Opportunity ID to analyze
 * @returns Coverage analysis with gap identification and recommendations
 */
export async function calculateEvidenceCoverage(opportunityId: string): Promise<ActionResult<CoverageAnalysis>> {
	try {
		await requireUserContext();

		// Get all evidence used for this opportunity
		const usages = await db.select().from(evidenceUsages).where(eq(evidenceUsages.opportunityId, opportunityId));

	// Get claims for this opportunity
	const claims = await db.select().from(claimAnalysis).where(eq(claimAnalysis.opportunityId, opportunityId));

	const totalClaims = claims.length || 1;
	const claimsWithEvidence = claims.filter((c) => c.hasEvidence).length;
	const coveragePercentage = Math.round((claimsWithEvidence / totalClaims) * 100);

	// Group claims by section and find gaps
	const sectionClaims = new Map<string, DBClaimAnalysis[]>();
	for (const claim of claims) {
		const sectionId = claim.sectionId || "unknown";
		if (!sectionClaims.has(sectionId)) {
			sectionClaims.set(sectionId, []);
		}
		sectionClaims.get(sectionId)!.push(claim);
	}

	const gapsBySection: { sectionId: string; sectionName: string; missingEvidence: string[] }[] = [];

	for (const [sectionId, sectionClaimsList] of sectionClaims) {
		const unsupported = sectionClaimsList.filter((c) => !c.hasEvidence || c.evidenceStrength === "weak");
		if (unsupported.length > 0) {
			gapsBySection.push({
				sectionId,
				sectionName: `Section ${sectionId}`,
				missingEvidence: unsupported.map((c) => c.claimText.substring(0, 100)),
			});
		}
	}

	// Generate recommendations based on coverage analysis
	const recommendations: string[] = [];

	if (coveragePercentage < 50) {
		recommendations.push("Critical: Less than half of claims have supporting evidence. Focus on high-risk claims first.");
	}
	if (coveragePercentage < 80) {
		recommendations.push("Consider adding evidence for high-risk unsupported claims before submission.");
	}
		if (gapsBySection.length > 3) {
			recommendations.push("Multiple sections have evidence gaps - prioritize by evaluation weight.");
		}

		return {
			success: true,
			data: {
				opportunityId,
				totalRequirements: totalClaims,
				coveredRequirements: claimsWithEvidence,
				coveragePercentage,
				gapsBySection,
				recommendations,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to calculate coverage: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Evidence Matrix Operations
// ============================================================================

/**
 * Generate an evidence coverage matrix for an opportunity.
 *
 * Creates a matrix mapping evidence against evaluation criteria, requirements,
 * or proposal sections. Provides visual representation of coverage and
 * identifies critical gaps.
 *
 * @param opportunityId - Opportunity ID
 * @param matrixType - Type of matrix to generate (evaluation_criteria, requirements, sections)
 * @returns Evidence matrix with coverage scores and gap analysis
 *
 * @example
 * ```typescript
 * const matrix = await generateEvidenceMatrix(opportunityId, 'evaluation_criteria');
 * console.log(`Overall coverage: ${matrix.overallCoverage}%`);
 * matrix.gaps.forEach(gap => {
 *   console.log(`Gap in ${gap.rowName}: missing ${gap.missingCategories.join(', ')}`);
 * });
 * ```
 */
export async function generateEvidenceMatrix(
	opportunityId: string,
	matrixType: EvidenceMatrixType
): Promise<ActionResult<EvidenceMatrixResult>> {
	try {
		const userContext = await requireUserContext();

	// Check for existing matrix
	const [existingMatrix] = await db
		.select()
		.from(evidenceMatrices)
		.where(and(eq(evidenceMatrices.opportunityId, opportunityId), eq(evidenceMatrices.matrixType, matrixType)));

	if (existingMatrix) {
		return {
			success: true,
			data: {
				id: existingMatrix.id,
				name: existingMatrix.name,
				rows: (existingMatrix.rows as EvidenceMatrixRow[]) || [],
				columns: (existingMatrix.columns as EvidenceMatrixColumn[]) || [],
				cells: (existingMatrix.cells as EvidenceMatrixCell[]) || [],
				overallCoverage: existingMatrix.overallCoverage,
				gaps: (existingMatrix.gapAnalysis as EvidenceMatrixGap[]) || [],
			},
		};
	}

	// Define matrix rows based on type
	const rows: EvidenceMatrixRow[] =
		matrixType === "evaluation_criteria"
			? [
					{ id: "technical", name: "Technical Approach", weight: 40 },
					{ id: "management", name: "Management Approach", weight: 25 },
					{ id: "past_performance", name: "Past Performance", weight: 25 },
					{ id: "price", name: "Price/Cost", weight: 10 },
				]
			: matrixType === "sections"
				? [
						{ id: "exec_summary", name: "Executive Summary" },
						{ id: "technical", name: "Technical Volume" },
						{ id: "management", name: "Management Volume" },
						{ id: "past_perf", name: "Past Performance Volume" },
					]
				: [
						{ id: "req1", name: "Requirement 1" },
						{ id: "req2", name: "Requirement 2" },
						{ id: "req3", name: "Requirement 3" },
					];

	// Define columns (evidence types)
	const columns: EvidenceMatrixColumn[] = [
		{ id: "metric", name: "Metrics" },
		{ id: "testimonial", name: "Testimonials" },
		{ id: "case_study", name: "Case Studies" },
		{ id: "certification", name: "Certifications" },
	];

	// Get evidence used for this opportunity
	const usages = await db.select().from(evidenceUsages).where(eq(evidenceUsages.opportunityId, opportunityId));

	const evidenceIds = [...new Set(usages.map((u) => u.evidenceId))];
	const evidenceItems =
		evidenceIds.length > 0 ? await db.select().from(evidenceLibrary).where(inArray(evidenceLibrary.id, evidenceIds)) : [];

	// Build cells mapping evidence to rows/columns
	const cells: EvidenceMatrixCell[] = [];
	const gaps: EvidenceMatrixGap[] = [];

	for (const row of rows) {
		const rowEvidenceByCol = new Map<string, string[]>();

		for (const col of columns) {
			// Find evidence matching this column's type
			const matchingEvidence = evidenceItems.filter((e) => e.evidenceType === col.id);

			rowEvidenceByCol.set(
				col.id,
				matchingEvidence.map((e) => e.id)
			);

			const coverageScore = matchingEvidence.length > 0 ? Math.min(100, matchingEvidence.length * 33) : 0;

			cells.push({
				rowId: row.id,
				colId: col.id,
				evidenceIds: matchingEvidence.map((e) => e.id),
				coverageScore,
			});
		}

		// Check for gaps in this row
		const missingCategories = columns
			.filter((col) => (rowEvidenceByCol.get(col.id)?.length || 0) === 0)
			.map((col) => col.name);

		if (missingCategories.length > 0) {
			const criticality: GapCriticality =
				missingCategories.length >= 3 ? "critical" : missingCategories.length >= 2 ? "major" : "minor";

			gaps.push({
				rowId: row.id,
				rowName: row.name,
				missingCategories,
				criticality,
			});
		}
	}

	// Calculate overall coverage
	const totalCells = cells.length;
	const coveredCells = cells.filter((c) => c.coverageScore > 0).length;
	const overallCoverage = Math.round((coveredCells / totalCells) * 100);

	// Store the matrix
	const [newMatrix] = await db
		.insert(evidenceMatrices)
		.values({
			opportunityId,
			name: `${matrixType.replace("_", " ")} Matrix`,
			matrixType,
			rows,
			columns,
			cells,
			overallCoverage,
			gapAnalysis: gaps,
			generatedBy: userContext.userId,
		})
		.returning();

		return {
			success: true,
			data: {
				id: newMatrix.id,
				name: newMatrix.name,
				rows,
				columns,
				cells,
				overallCoverage,
				gaps,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to generate matrix: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Update a cell in an evidence matrix.
 *
 * Allows manual assignment or removal of evidence from matrix cells.
 * Automatically recalculates coverage and gap analysis after update.
 *
 * @param matrixId - Matrix ID
 * @param rowId - Row ID
 * @param colId - Column ID
 * @param evidenceIds - Evidence IDs to assign to the cell
 *
 * @throws Error if matrix not found
 */
export async function updateMatrixCell(
	matrixId: string,
	rowId: string,
	colId: string,
	evidenceIds: string[]
): Promise<ActionResult<{ updated: boolean }>> {
	try {
		await requireUserContext();

		const [matrix] = await db.select().from(evidenceMatrices).where(eq(evidenceMatrices.id, matrixId));

		if (!matrix) {
			return { success: false, error: "Matrix not found" };
		}

	// Update the cell
	const cells = [...((matrix.cells as EvidenceMatrixCell[]) || [])];
	const cellIndex = cells.findIndex((c) => c.rowId === rowId && c.colId === colId);

	const newCell: EvidenceMatrixCell = {
		rowId,
		colId,
		evidenceIds,
		coverageScore: evidenceIds.length > 0 ? Math.min(100, evidenceIds.length * 33) : 0,
	};

	if (cellIndex >= 0) {
		cells[cellIndex] = newCell;
	} else {
		cells.push(newCell);
	}

	// Recalculate overall coverage
	const totalCells = cells.length;
	const coveredCells = cells.filter((c) => c.coverageScore > 0).length;
	const overallCoverage = Math.round((coveredCells / totalCells) * 100);

	// Recalculate gaps
	const rows = (matrix.rows as EvidenceMatrixRow[]) || [];
	const columns = (matrix.columns as EvidenceMatrixColumn[]) || [];
	const gaps: EvidenceMatrixGap[] = [];

	for (const row of rows) {
		const missingCategories = columns.filter((col) => {
			const cell = cells.find((c) => c.rowId === row.id && c.colId === col.id);
			return !cell || cell.evidenceIds.length === 0;
		});

		if (missingCategories.length > 0) {
			gaps.push({
				rowId: row.id,
				rowName: row.name,
				missingCategories: missingCategories.map((c) => c.name),
				criticality: missingCategories.length >= 3 ? "critical" : missingCategories.length >= 2 ? "major" : "minor",
			});
		}
	}

		await db
			.update(evidenceMatrices)
			.set({
				cells,
				overallCoverage,
				gapAnalysis: gaps,
			})
			.where(eq(evidenceMatrices.id, matrixId));

		revalidatePath(`/matrices/${matrixId}`);
		return { success: true, data: { updated: true } };
	} catch (error) {
		return { success: false, error: `Failed to update matrix cell: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Claim Quantification
// ============================================================================

/**
 * Generate quantification suggestions for a claim.
 *
 * Analyzes a qualitative claim and suggests ways to add measurable data,
 * making it more compelling for proposal evaluators. Returns multiple
 * quantified versions with different metrics and data sources.
 *
 * @param claimText - The claim text to quantify
 * @param context - Optional context about the claim (section, opportunity)
 * @returns Quantification suggestions with metrics and data sources
 *
 * @example
 * ```typescript
 * const suggestions = await quantifyClaim(
 *   "We have extensive experience in cloud migration",
 *   "Technical approach section for federal IT modernization"
 * );
 * // Returns quantified versions like:
 * // "We have migrated 500+ applications across 15 federal agencies since 2019"
 * ```
 */
export async function quantifyClaim(claimText: string, context?: string): Promise<ActionResult<QuantificationSuggestion>> {
	try {
		await requireUserContext();

		// Generate quantification suggestions based on claim type analysis
		// In production, this would use AI for intelligent suggestions

		const suggestions: QuantificationSuggestion = {
		originalClaim: claimText,
		quantifiedVersions: [],
		metrics: [],
	};

	// Detect claim type and generate appropriate quantifications
	const claimLower = claimText.toLowerCase();

	if (claimLower.includes("experience") || claimLower.includes("delivered") || claimLower.includes("completed")) {
		suggestions.quantifiedVersions.push({
			text: claimText.replace(/extensive|significant|substantial/gi, "15+ years of"),
			evidenceNeeded: "Project records, contract history",
			strengthIncrease: 35,
			dataSource: "Contract management system",
		});
		suggestions.quantifiedVersions.push({
			text: claimText + ", completing over 50 similar projects for federal agencies",
			evidenceNeeded: "Past performance records",
			strengthIncrease: 45,
			dataSource: "CPARS records, proposal library",
		});
		suggestions.metrics.push(
			{ name: "Years of experience", unit: "years", example: "15+" },
			{ name: "Projects completed", unit: "count", example: "50+" },
			{ name: "Contract value delivered", unit: "dollars", example: "$100M+" }
		);
	}

	if (claimLower.includes("uptime") || claimLower.includes("availability") || claimLower.includes("reliable")) {
		suggestions.quantifiedVersions.push({
			text: claimText.replace(/high|excellent|superior/gi, "99.9%"),
			evidenceNeeded: "System monitoring data, SLA compliance reports",
			strengthIncrease: 50,
			dataSource: "Infrastructure monitoring tools",
		});
		suggestions.metrics.push(
			{ name: "Uptime percentage", unit: "%", example: "99.9%" },
			{ name: "Mean time to recovery", unit: "minutes", example: "<15 min" }
		);
	}

	if (claimLower.includes("savings") || claimLower.includes("efficiency") || claimLower.includes("reduce")) {
		suggestions.quantifiedVersions.push({
			text: claimText.replace(/significant|substantial/gi, "25%"),
			evidenceNeeded: "Cost analysis, before/after comparison data",
			strengthIncrease: 40,
			dataSource: "Financial reports, customer testimonials",
		});
		suggestions.metrics.push(
			{ name: "Cost reduction", unit: "%", example: "25%" },
			{ name: "Time savings", unit: "hours/week", example: "40 hours/week" },
			{ name: "ROI achieved", unit: "ratio", example: "3:1" }
		);
	}

	// Add generic suggestions if no specific patterns matched
	if (suggestions.quantifiedVersions.length === 0) {
		suggestions.quantifiedVersions.push({
			text: claimText + " (add specific metrics here)",
			evidenceNeeded: "Relevant project data, performance records",
			strengthIncrease: 30,
			dataSource: "Internal records, customer feedback",
		});
		suggestions.metrics.push(
			{ name: "Quantity", unit: "count", example: "number of items/projects" },
			{ name: "Percentage", unit: "%", example: "improvement rate" },
			{ name: "Time", unit: "days/weeks", example: "duration or time saved" }
		);
		}

		return { success: true, data: suggestions };
	} catch (error) {
		return { success: false, error: `Failed to quantify claim: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Suggest metrics for a category of evidence.
 *
 * Returns common metrics used for a particular evidence category,
 * helping standardize quantification approaches across the library.
 *
 * @param category - Evidence category (technical, management, past_performance, etc.)
 * @returns Array of suggested metrics with units and benchmarks
 */
export async function suggestMetrics(
	category: string
): Promise<ActionResult<{ metric: string; unit: string; benchmark?: string }[]>> {
	try {
		const metricsByCategory: Record<string, { metric: string; unit: string; benchmark?: string }[]> = {
		technical: [
			{ metric: "Uptime", unit: "percentage", benchmark: "99.9%" },
			{ metric: "Response time", unit: "milliseconds", benchmark: "<200ms" },
			{ metric: "Error rate", unit: "percentage", benchmark: "<0.1%" },
			{ metric: "Throughput", unit: "transactions/second", benchmark: "10,000+" },
			{ metric: "Code coverage", unit: "percentage", benchmark: ">80%" },
		],
		management: [
			{ metric: "Project completion rate", unit: "percentage", benchmark: "95%+" },
			{ metric: "On-time delivery", unit: "percentage", benchmark: "90%+" },
			{ metric: "Staff retention", unit: "percentage", benchmark: ">85%" },
			{ metric: "Training hours", unit: "hours/employee", benchmark: "40+" },
			{ metric: "Customer satisfaction", unit: "rating", benchmark: "4.5/5.0" },
		],
		past_performance: [
			{ metric: "Contracts completed", unit: "count", benchmark: "50+" },
			{ metric: "Contract value delivered", unit: "dollars", benchmark: "$100M+" },
			{ metric: "CPARS rating", unit: "rating", benchmark: "Exceptional" },
			{ metric: "Recompete wins", unit: "percentage", benchmark: ">80%" },
			{ metric: "Years of experience", unit: "years", benchmark: "10+" },
		],
		cost_efficiency: [
			{ metric: "Cost savings achieved", unit: "percentage", benchmark: "20%+" },
			{ metric: "ROI delivered", unit: "ratio", benchmark: "3:1" },
			{ metric: "Budget variance", unit: "percentage", benchmark: "<5%" },
			{ metric: "Efficiency improvement", unit: "percentage", benchmark: "25%+" },
		],
		innovation: [
			{ metric: "Patents filed", unit: "count", benchmark: "10+" },
			{ metric: "New features delivered", unit: "count/year" },
			{ metric: "Process improvements", unit: "count", benchmark: "20+" },
			{ metric: "Automation rate", unit: "percentage", benchmark: ">50%" },
		],
		};

		return { success: true, data: metricsByCategory[category] || metricsByCategory.technical };
	} catch (error) {
		return { success: false, error: `Failed to suggest metrics: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Evidence Strength Rating
// ============================================================================

/**
 * Perform multi-dimensional strength analysis on evidence.
 *
 * Evaluates evidence across five key dimensions that matter to proposal
 * evaluators: recency, specificity, quantification, verifiability, and
 * relevance. Provides a tier classification and improvement recommendations.
 *
 * @param evidenceId - Evidence ID to rate
 * @returns Detailed strength rating with dimension scores and improvements
 *
 * @example
 * ```typescript
 * const rating = await rateEvidenceStrength(evidenceId);
 * console.log(`Overall: ${rating.overallScore} (${rating.tier} tier)`);
 * rating.improvements.forEach(imp => {
 *   console.log(`${imp.dimension}: ${imp.suggestion}`);
 * });
 * ```
 */
export async function rateEvidenceStrength(evidenceId: string): Promise<ActionResult<StrengthRating>> {
	try {
		const userContext = await requireUserContext();

		// Get evidence
		const [evidence] = await db.select().from(evidenceLibrary).where(eq(evidenceLibrary.id, evidenceId));

		if (!evidence) {
			return { success: false, error: "Evidence not found" };
		}

	// Calculate dimension scores
	const dimensions = {
		recency: { score: 70, notes: "Score based on source date" },
		specificity: { score: 60, notes: "Score based on detail level" },
		quantification: { score: 50, notes: "Score based on metric presence" },
		verifiability: { score: 60, notes: "Score based on source verification" },
		relevance: { score: 75, notes: "Score based on category alignment" },
	};

	// Recency score
	if (evidence.sourceDate) {
		const sourceDate = new Date(evidence.sourceDate);
		const yearsOld = (Date.now() - sourceDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
		dimensions.recency.score = Math.max(0, 100 - yearsOld * 15);
		dimensions.recency.notes = yearsOld < 1 ? "Recent evidence (< 1 year)" : `Evidence is ${Math.floor(yearsOld)} years old`;
	}

	// Specificity score
	const contentLength = evidence.content.length;
	dimensions.specificity.score = Math.min(100, 40 + contentLength / 50);
	dimensions.specificity.notes =
		contentLength > 500 ? "Detailed, specific content" : "Could include more specific details";

	// Quantification score
	if (evidence.isQuantified && evidence.metric && evidence.metricValue) {
		dimensions.quantification.score = 85;
		dimensions.quantification.notes = `Quantified with ${evidence.metric}: ${evidence.metricValue}${evidence.metricUnit || ""}`;
		if (evidence.metricContext) {
			dimensions.quantification.score = 95;
			dimensions.quantification.notes += " with context";
		}
	} else {
		dimensions.quantification.score = 30;
		dimensions.quantification.notes = "No quantification present";
	}

	// Verifiability score
	if (evidence.sourceVerified) {
		dimensions.verifiability.score = 95;
		dimensions.verifiability.notes = "Source has been verified";
	} else if (evidence.sourceReference) {
		dimensions.verifiability.score = 70;
		dimensions.verifiability.notes = "Source reference provided but not verified";
	} else {
		dimensions.verifiability.score = 40;
		dimensions.verifiability.notes = "No source verification";
	}

	// Relevance score (based on having related capabilities)
	const capCount = (evidence.relatedCapabilities as string[] || []).length;
	dimensions.relevance.score = Math.min(100, 50 + capCount * 10);
	dimensions.relevance.notes = capCount > 0 ? `Linked to ${capCount} capabilities` : "No capability links";

	// Calculate overall score
	const scores = [
		dimensions.recency.score,
		dimensions.specificity.score,
		dimensions.quantification.score,
		dimensions.verifiability.score,
		dimensions.relevance.score,
	];
	const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

	// Generate improvements for lowest-scoring dimensions
	const improvements: StrengthImprovementSuggestion[] = [];

	const sortedDimensions = Object.entries(dimensions).sort((a, b) => a[1].score - b[1].score);

	for (const [dimension, { score }] of sortedDimensions.slice(0, 3)) {
		if (score < 80) {
			let suggestion = "";
			const potentialScore = Math.min(100, score + 25);

			switch (dimension) {
				case "recency":
					suggestion = "Update with more recent data or verify current applicability";
					break;
				case "specificity":
					suggestion = "Add specific project names, dates, client names, and detailed outcomes";
					break;
				case "quantification":
					suggestion = "Add measurable metrics with values, units, and context";
					break;
				case "verifiability":
					suggestion = "Add verifiable source reference and mark as verified when confirmed";
					break;
				case "relevance":
					suggestion = "Link to specific organizational capabilities and NAICS codes";
					break;
			}

			improvements.push({
				dimension,
				current: score,
				potential: potentialScore,
				suggestion,
			});
		}
	}

	// Store analysis
	await db.insert(evidenceStrengthAnalysis).values({
		evidenceId,
		recencyScore: dimensions.recency.score,
		specificityScore: dimensions.specificity.score,
		quantificationScore: dimensions.quantification.score,
		verifiabilityScore: dimensions.verifiability.score,
		relevanceScore: dimensions.relevance.score,
		compositeScore: overallScore,
		tier: calculateTier(overallScore),
		improvementSuggestions: improvements,
	});

	// Update evidence with strength score
	await db
		.update(evidenceLibrary)
		.set({
			strengthScore: overallScore,
			strengthFactors: [
				{ factor: "Recency", score: dimensions.recency.score },
				{ factor: "Specificity", score: dimensions.specificity.score },
				{ factor: "Quantification", score: dimensions.quantification.score },
				{ factor: "Verifiability", score: dimensions.verifiability.score },
				{ factor: "Relevance", score: dimensions.relevance.score },
			],
			updatedAt: new Date(),
		})
		.where(eq(evidenceLibrary.id, evidenceId));

		return {
			success: true,
			data: {
				overallScore,
				tier: calculateTier(overallScore),
				dimensions,
				improvements,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to rate evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Rate multiple evidence items in batch.
 *
 * Efficiently analyzes strength for multiple evidence items,
 * useful for library-wide quality assessment or periodic reviews.
 *
 * @param evidenceIds - Array of evidence IDs to rate
 * @returns Map of evidence IDs to their strength ratings
 */
export async function batchRateEvidence(evidenceIds: string[]): Promise<ActionResult<Record<string, StrengthRating>>> {
	try {
		const results: Record<string, StrengthRating> = {};

		// Rate each piece of evidence, continuing even if some fail
		for (const evidenceId of evidenceIds) {
			try {
				const result = await rateEvidenceStrength(evidenceId);
				if (result.success) {
					results[evidenceId] = result.data;
				}
			} catch (error) {
				console.error(`Error rating evidence ${evidenceId}:`, error);
				// Continue processing other evidence
			}
		}

		return { success: true, data: results };
	} catch (error) {
		return { success: false, error: `Failed to batch rate evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Usage Tracking
// ============================================================================

/**
 * Record usage of evidence in a document.
 *
 * Tracks when and how evidence is used in proposals for analytics,
 * effectiveness measurement, and usage pattern analysis.
 *
 * @param evidenceId - Evidence ID being used
 * @param usage - Usage details including document, section, and usage type
 */
export async function recordEvidenceUsage(evidenceId: string, usage: EvidenceUsageInput): Promise<ActionResult<{ recorded: boolean }>> {
	try {
		const userContext = await requireUserContext();
		const validated = evidenceUsageInputSchema.parse(usage);

		await db.insert(evidenceUsages).values({
			evidenceId,
			documentId: validated.documentId,
			opportunityId: validated.opportunityId,
			sectionId: validated.sectionId,
			sectionName: validated.sectionName,
			usageType: validated.usageType,
			usedText: validated.usedText,
			context: validated.context,
			usedBy: userContext.userId,
		});

		// Update usage count on evidence
		await db
			.update(evidenceLibrary)
			.set({
				useCount: sql`${evidenceLibrary.useCount} + 1`,
				lastUsedAt: new Date(),
				lastUsedInOpportunityId: validated.opportunityId,
			})
			.where(eq(evidenceLibrary.id, evidenceId));

		revalidatePath("/evidence");
		return { success: true, data: { recorded: true } };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map(i => i.message).join(", ") };
		}
		return { success: false, error: `Failed to record usage: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Get usage history for an evidence item.
 *
 * Retrieves all instances where the evidence was used in documents,
 * including context, section, and timing information.
 *
 * @param evidenceId - Evidence ID
 * @returns Array of usage records ordered by most recent first
 */
export async function getEvidenceUsageHistory(evidenceId: string): Promise<ActionResult<DBEvidenceUsage[]>> {
	try {
		await requireUserContext();

		const usages = await db
			.select()
			.from(evidenceUsages)
			.where(eq(evidenceUsages.evidenceId, evidenceId))
			.orderBy(desc(evidenceUsages.usedAt));

		return { success: true, data: usages };
	} catch (error) {
		return { success: false, error: `Failed to get usage history: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Get most frequently used evidence items.
 *
 * Returns evidence ranked by usage count, identifying high-value
 * proof points that are frequently incorporated into proposals.
 *
 * @param limit - Maximum number of items to return (default: 10)
 * @returns Array of evidence with usage counts
 */
export async function getMostUsedEvidence(limit: number = 10): Promise<ActionResult<{ evidence: Evidence; useCount: number }[]>> {
	try {
		await requireUserContext();

		const results = await db
			.select()
			.from(evidenceLibrary)
			.where(gte(evidenceLibrary.useCount, 1))
			.orderBy(desc(evidenceLibrary.useCount))
			.limit(limit);

		return {
			success: true,
			data: results.map((r) => ({
				evidence: mapDBEvidenceToEvidence(r),
				useCount: r.useCount || 0,
			})),
		};
	} catch (error) {
		return { success: false, error: `Failed to get most used evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Reports
// ============================================================================

/**
 * Generate a comprehensive evidence report for an opportunity.
 *
 * Creates a summary report including library statistics, top-performing
 * evidence, quality issues, and actionable recommendations for improvement.
 *
 * @param opportunityId - Opportunity ID
 * @returns Evidence report with summary, rankings, and recommendations
 *
 * @example
 * ```typescript
 * const report = await generateEvidenceReport(opportunityId);
 * console.log(`Total evidence: ${report.summary.total}`);
 * console.log(`Average strength: ${report.summary.averageStrength}`);
 * report.recommendations.forEach(r => console.log(`- ${r}`));
 * ```
 */
export async function generateEvidenceReport(opportunityId: string): Promise<ActionResult<EvidenceReport>> {
	try {
		await requireUserContext();

		// Get all evidence used for this opportunity
		const usages = await db.select().from(evidenceUsages).where(eq(evidenceUsages.opportunityId, opportunityId));

	const evidenceIds = [...new Set(usages.map((u) => u.evidenceId))];
	const evidenceItems =
		evidenceIds.length > 0 ? await db.select().from(evidenceLibrary).where(inArray(evidenceLibrary.id, evidenceIds)) : [];

	// Calculate summary statistics
	const byType: Record<string, number> = {};
	let totalStrength = 0;
	let strengthCount = 0;

	for (const ev of evidenceItems) {
		const type = ev.evidenceType || "unknown";
		byType[type] = (byType[type] || 0) + 1;

		if (ev.strengthScore) {
			totalStrength += ev.strengthScore;
			strengthCount++;
		}
	}

	const averageStrength = strengthCount > 0 ? Math.round(totalStrength / strengthCount) : 0;

	// Identify top evidence (high strength and frequently used)
	const topEvidence = evidenceItems
		.filter((e) => e.strengthScore && e.strengthScore >= 70)
		.sort((a, b) => (b.strengthScore || 0) - (a.strengthScore || 0))
		.slice(0, 5)
		.map((e) => ({
			id: e.id,
			title: e.title,
			strengthScore: e.strengthScore || 0,
			useCount: e.useCount || 0,
		}));

	// Identify weak evidence needing improvement
	const weakEvidence = evidenceItems
		.filter((e) => !e.strengthScore || e.strengthScore < 60)
		.slice(0, 5)
		.map((e) => ({
			id: e.id,
			title: e.title,
			issues: [
				!e.strengthScore ? "Not analyzed for strength" : `Low strength score: ${e.strengthScore}`,
				!e.isQuantified ? "Not quantified" : null,
				!e.sourceVerified ? "Source not verified" : null,
			].filter(Boolean) as string[],
		}));

	// Generate recommendations
	const recommendations: string[] = [];

	if (averageStrength < 70) {
		recommendations.push("Average evidence strength is below target (70). Focus on strengthening weak evidence items.");
	}
	if (topEvidence.length < 3) {
		recommendations.push("Limited high-quality evidence. Add more gold-tier proof points with quantified metrics.");
	}
	if (!byType.metric || byType.metric < 3) {
		recommendations.push("Add more quantified metrics to strengthen proposal evaluation score.");
	}
	if (!byType.testimonial) {
		recommendations.push("Consider adding customer testimonials for social proof and credibility.");
	}
		if (weakEvidence.length > evidenceItems.length * 0.3) {
			recommendations.push("Over 30% of evidence needs improvement. Prioritize quality over quantity.");
		}

		return {
			success: true,
			data: {
				summary: {
					total: evidenceItems.length,
					byType,
					averageStrength,
				},
				topEvidence,
				weakEvidence,
				recommendations,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Export evidence library in specified format.
 *
 * Generates a downloadable export of evidence data for backup,
 * sharing, or external analysis. Supports CSV and JSON formats.
 *
 * @param format - Export format ('csv' or 'json')
 * @returns Object with URL to download the export
 */
export async function exportEvidenceLibrary(format: "csv" | "json"): Promise<ActionResult<{ url: string }>> {
	try {
		await requireUserContext();

		// Get all evidence for the organization
		const allEvidenceResult = await listEvidence({ limit: 10000 });
		if (!allEvidenceResult.success) {
			return { success: false, error: allEvidenceResult.error };
		}

		// Generate export timestamp for unique filename
		const timestamp = Date.now();

		// Generate export through API endpoint which handles file creation
		// The API endpoint creates the file in /tmp or blob storage and returns download URL
		const filename = `evidence-library-${timestamp}.${format}`;
		const downloadUrl = `/api/evidence/export?format=${format}&filename=${encodeURIComponent(filename)}`;

		// Log export for audit
		console.info("Evidence library export initiated:", {
			format,
			filename,
			evidenceCount: allEvidenceResult.data?.length || 0,
		});

		return { success: true, data: { url: downloadUrl } };
	} catch (error) {
		return { success: false, error: `Failed to export evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

// ============================================================================
// Component-Compatible Aliases and Additional Functions
// ============================================================================

/**
 * Alias for analyzeClaimsInDocument for component compatibility.
 * @see analyzeClaimsInDocument
 */
export const analyzeDocumentClaims = analyzeClaimsInDocument;

/**
 * Alias for getEvidence for component compatibility.
 * @see getEvidence
 */
export const getEvidenceById = getEvidence;

/**
 * Alias for suggestEvidenceForClaim for component compatibility.
 * @see suggestEvidenceForClaim
 */
export const getSuggestedEvidence = suggestEvidenceForClaim;

/**
 * Alias for rateEvidenceStrength for component compatibility.
 * @see rateEvidenceStrength
 */
export const getStrengthAnalysis = rateEvidenceStrength;

/**
 * Alias for quantifyClaim for component compatibility.
 * @see quantifyClaim
 */
export const generateQuantification = quantifyClaim;

/**
 * Alias for generateEvidenceMatrix for component compatibility.
 * @see generateEvidenceMatrix
 */
export const getEvidenceMatrix = generateEvidenceMatrix;

/**
 * Claims summary statistics for a document.
 */
export interface ClaimsSummary {
	totalClaims: number;
	highRiskClaims: number;
	mediumRiskClaims: number;
	lowRiskClaims: number;
	resolvedClaims: number;
	unresolvedClaims: number;
	averageEvidenceStrength: number;
	coveragePercentage: number;
}

/**
 * Get summary statistics for claims in a document.
 *
 * @param documentId - ID of the document to summarize
 * @returns Claims summary statistics
 */
export async function getClaimsSummary(documentId: string): Promise<ActionResult<ClaimsSummary>> {
	try {
		await requireUserContext();

		// Get all claims for the document
		const claims = await db
			.select()
			.from(claimAnalysis)
			.where(eq(claimAnalysis.documentId, documentId));

		const totalClaims = claims.length;
		const highRiskClaims = claims.filter(c => c.riskLevel === "high").length;
		const mediumRiskClaims = claims.filter(c => c.riskLevel === "medium").length;
		const lowRiskClaims = claims.filter(c => c.riskLevel === "low").length;
		const resolvedClaims = claims.filter(c => c.status === "resolved").length;
		const unresolvedClaims = totalClaims - resolvedClaims;

		// Calculate average evidence strength
		const strengthScores = claims
			.filter(c => c.evidenceStrength !== null)
			.map(c => {
				const strengthMap: Record<string, number> = {
					strong: 100,
					moderate: 70,
					weak: 40,
					none: 0,
				};
				return strengthMap[c.evidenceStrength as string] ?? 0;
			});

		const averageEvidenceStrength = strengthScores.length > 0
			? Math.round(strengthScores.reduce((a, b) => a + b, 0) / strengthScores.length)
			: 0;

		// Calculate coverage percentage (claims with at least moderate evidence)
		const coveredClaims = claims.filter(
			c => c.evidenceStrength === "strong" || c.evidenceStrength === "moderate"
		).length;
		const coveragePercentage = totalClaims > 0
			? Math.round((coveredClaims / totalClaims) * 100)
			: 100;

		return {
			success: true,
			data: {
				totalClaims,
				highRiskClaims,
				mediumRiskClaims,
				lowRiskClaims,
				resolvedClaims,
				unresolvedClaims,
				averageEvidenceStrength,
				coveragePercentage,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to get claims summary: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Duplicate an evidence item.
 *
 * Creates a copy of an existing evidence item with "(Copy)" appended to the title.
 *
 * @param id - ID of the evidence to duplicate
 * @returns Newly created duplicate evidence
 */
export async function duplicateEvidence(id: string): Promise<ActionResult<Evidence>> {
	try {
		await requireUserContext();

		// Get the original evidence
		const originalResult = await getEvidence(id);
		if (!originalResult.success) {
			return { success: false, error: originalResult.error };
		}

		const original = originalResult.data;

		// Create duplicate with modified title
		const duplicateData: CreateEvidenceInput = {
			title: `${original.title} (Copy)`,
			content: original.content,
			summary: original.summary ?? undefined,
			evidenceType: original.evidenceType ?? undefined,
			category: original.category ?? undefined,
			subcategory: original.subcategory ?? undefined,
			tags: original.tags,
			isQuantified: original.isQuantified,
			metric: original.metric ?? undefined,
			metricValue: original.metricValue ?? undefined,
			metricUnit: original.metricUnit ?? undefined,
			metricContext: original.metricContext ?? undefined,
			sourceType: original.sourceType ?? undefined,
			sourceReference: original.sourceReference ?? undefined,
			sourceDate: original.sourceDate ?? undefined,
			sourceVerified: original.sourceVerified,
			verificationNotes: original.verificationNotes ?? undefined,
			relatedCapabilities: original.relatedCapabilities ?? undefined,
			relatedNaicsCodes: original.relatedNaicsCodes ?? undefined,
			relatedAgencies: original.relatedAgencies ?? undefined,
			status: "draft", // Always start as draft
		};

		return createEvidence(duplicateData);
	} catch (error) {
		return { success: false, error: `Failed to duplicate evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Archive an evidence item.
 *
 * Soft-deletes evidence by changing its status to 'archived'.
 *
 * @param id - ID of the evidence to archive
 */
export async function archiveEvidence(id: string): Promise<ActionResult<{ archived: boolean }>> {
	try {
		const userContext = await requireUserContext();

		// Build where clause - if user has organizationId, filter by it
		const whereClause = userContext.organizationId
			? and(
					eq(evidenceLibrary.id, id),
					eq(evidenceLibrary.organizationId, userContext.organizationId)
				)
			: eq(evidenceLibrary.id, id);

		await db
			.update(evidenceLibrary)
			.set({
				status: "archived",
				updatedAt: new Date(),
			})
			.where(whereClause);

		revalidatePath("/evidence");
		return { success: true, data: { archived: true } };
	} catch (error) {
		return { success: false, error: `Failed to archive evidence: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Evidence import preview result.
 */
export interface ImportPreview {
	totalRows: number;
	validRows: number;
	invalidRows: number;
	duplicates: number;
	preview: Partial<CreateEvidenceInput>[];
	errors: Array<{ row: number; field: string; message: string }>;
}

/**
 * Evidence import result.
 */
export interface ImportResult {
	imported: number;
	skipped: number;
	errors: Array<{ row: number; message: string }>;
}

/**
 * Preview an import of evidence from CSV/JSON data.
 *
 * Validates the import data and returns a preview of what would be imported.
 *
 * @param data - Raw import data (CSV string or JSON array)
 * @param format - Data format ('csv' or 'json')
 * @returns Import preview with validation results
 */
export async function previewImport(
	data: string,
	format: "csv" | "json"
): Promise<ActionResult<ImportPreview>> {
	try {
		await requireUserContext();

	let rows: Record<string, unknown>[] = [];

	// Parse data based on format
	if (format === "json") {
		try {
			rows = JSON.parse(data);
			if (!Array.isArray(rows)) {
				rows = [rows];
			}
		} catch {
			return {
				success: true,
				data: {
					totalRows: 0,
					validRows: 0,
					invalidRows: 1,
					duplicates: 0,
					preview: [],
					errors: [{ row: 0, field: "data", message: "Invalid JSON format" }],
				},
			};
		}
	} else {
		// Simple CSV parsing
		const lines = data.trim().split("\n");
		if (lines.length < 2) {
			return {
				success: true,
				data: {
					totalRows: 0,
					validRows: 0,
					invalidRows: 0,
					duplicates: 0,
					preview: [],
					errors: [{ row: 0, field: "data", message: "CSV must have header and at least one data row" }],
				},
			};
		}

		const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
		rows = lines.slice(1).map(line => {
			const values = line.split(",");
			const row: Record<string, unknown> = {};
			headers.forEach((header, i) => {
				row[header] = values[i]?.trim() ?? "";
			});
			return row;
		});
	}

	const totalRows = rows.length;
	const errors: Array<{ row: number; field: string; message: string }> = [];
	const validatedRows: Partial<CreateEvidenceInput>[] = [];

	// Validate each row
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const validated: Partial<CreateEvidenceInput> = {};

		// Required fields
		if (typeof row.title === "string" && row.title.trim()) {
			validated.title = row.title.trim();
		} else {
			errors.push({ row: i + 1, field: "title", message: "Title is required" });
			continue;
		}

		if (typeof row.content === "string" && row.content.trim()) {
			validated.content = row.content.trim();
		} else {
			errors.push({ row: i + 1, field: "content", message: "Content is required" });
			continue;
		}

		// Optional fields
		if (typeof row.summary === "string") validated.summary = row.summary;
		if (typeof row.evidenceType === "string") validated.evidenceType = row.evidenceType as EvidenceType;
		if (typeof row.category === "string") validated.category = row.category as EvidenceCategory;
		if (typeof row.subcategory === "string") validated.subcategory = row.subcategory;
		if (typeof row.tags === "string") validated.tags = row.tags.split(";").map(t => t.trim());
		if (Array.isArray(row.tags)) validated.tags = row.tags;

		validatedRows.push(validated);
	}

		// Check for duplicates (by title)
		const existingEvidenceResult = await listEvidence({ limit: 10000 });
		const existingTitles = existingEvidenceResult.success
			? new Set(existingEvidenceResult.data.map(e => e.title.toLowerCase()))
			: new Set<string>();
		const duplicates = validatedRows.filter(r =>
			r.title && existingTitles.has(r.title.toLowerCase())
		).length;

		return {
			success: true,
			data: {
				totalRows,
				validRows: validatedRows.length,
				invalidRows: totalRows - validatedRows.length,
				duplicates,
				preview: validatedRows.slice(0, 10), // Show first 10 for preview
				errors,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to preview import: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Execute an evidence import.
 *
 * Imports validated evidence data into the library.
 *
 * @param data - Raw import data (CSV string or JSON array)
 * @param format - Data format ('csv' or 'json')
 * @param skipDuplicates - Whether to skip rows with duplicate titles
 * @returns Import result with success/error counts
 */
export async function executeImport(
	data: string,
	format: "csv" | "json",
	skipDuplicates: boolean = true
): Promise<ActionResult<ImportResult>> {
	try {
		await requireUserContext();

		// First preview to get validated rows
		const previewResult = await previewImport(data, format);

		if (!previewResult.success) {
			return { success: false, error: previewResult.error };
		}

		const preview = previewResult.data;

		if (preview.validRows === 0) {
			return {
				success: true,
				data: {
					imported: 0,
					skipped: preview.invalidRows,
					errors: preview.errors.map(e => ({ row: e.row, message: `${e.field}: ${e.message}` })),
				},
			};
		}

		// Get existing titles for duplicate check
		const existingEvidenceResult = await listEvidence({ limit: 10000 });
		const existingTitles = existingEvidenceResult.success
			? new Set(existingEvidenceResult.data.map(e => e.title.toLowerCase()))
			: new Set<string>();

	const errors: Array<{ row: number; message: string }> = [];
	let imported = 0;
	let skipped = 0;

	// Import each validated row
	for (let i = 0; i < preview.preview.length; i++) {
		const row = preview.preview[i];

		if (!row.title || !row.content) {
			skipped++;
			continue;
		}

		// Skip duplicates if requested
		if (skipDuplicates && existingTitles.has(row.title.toLowerCase())) {
			skipped++;
			continue;
		}

		try {
			await createEvidence(row as CreateEvidenceInput);
			imported++;
		} catch (error) {
			errors.push({ row: i + 1, message: error instanceof Error ? error.message : "Unknown error" });
			skipped++;
		}
	}

		revalidatePath("/evidence");

		return {
			success: true,
			data: {
				imported,
				skipped,
				errors,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to execute import: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}

/**
 * Evidence usage statistics.
 */
export interface EvidenceUsageStats {
	totalUsages: number;
	proposalUsages: number;
	documentUsages: number;
	sectionUsages: number;
	winRate: number;
	averageScore: number;
	recentUsages: Array<{
		usageId: string;
		opportunityId: string | null;
		opportunityTitle?: string;
		usedAt: Date;
		usageType: EvidenceUsageType;
	}>;
}

/**
 * Get usage statistics for a piece of evidence.
 *
 * @param evidenceId - ID of the evidence to get stats for
 * @returns Usage statistics
 */
export async function getEvidenceUsageStats(evidenceId: string): Promise<ActionResult<EvidenceUsageStats>> {
	try {
		const { organizationId } = await requireUserContext();

		// Get all usages for this evidence
		const usages = await db
			.select()
			.from(evidenceUsages)
			.where(eq(evidenceUsages.evidenceId, evidenceId))
			.orderBy(desc(evidenceUsages.usedAt));

		const totalUsages = usages.length;
		// Note: usageType in schema is direct_quote, paraphrased, supporting, reference
		// We'll categorize based on document/section presence
		const proposalUsages = usages.filter(u => u.opportunityId !== null).length;
		const documentUsages = usages.filter(u => u.documentId !== null).length;
		const sectionUsages = usages.filter(u => u.sectionId !== null).length;

		// Win rate and average score require fields not in current schema
		// Return 0 for now - these can be added to schema if needed
		const winRate = 0;
		const averageScore = 0;

		// Get recent usages (last 10)
		const recentUsages = usages.slice(0, 10).map(u => ({
			usageId: u.id,
			opportunityId: u.opportunityId,
			usedAt: u.usedAt ?? new Date(),
			usageType: u.usageType ?? "supporting" as EvidenceUsageType,
		}));

		return {
			success: true,
			data: {
				totalUsages,
				proposalUsages,
				documentUsages,
				sectionUsages,
				winRate,
				averageScore,
				recentUsages,
			},
		};
	} catch (error) {
		return { success: false, error: `Failed to get usage stats: ${error instanceof Error ? error.message : "Unknown error"}` };
	}
}
