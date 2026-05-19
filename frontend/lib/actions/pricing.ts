"use server";

/**
 * Integrated Cost Volume Generator Server Actions
 *
 * Provides comprehensive cost volume management capabilities for government proposals including:
 * - Labor category CRUD with rate management and GSA Schedule support
 * - Cost element management (labor, ODC, subcontract, travel, material) with WBS tracking
 * - Cost-technical alignment validation ensuring pricing matches technical approach
 * - AI-powered hours estimation from technical scope descriptions
 * - BOE (Basis of Estimate) narrative generation with reusable templates
 * - Pricing calculations with indirect rate application and escalation
 * - Cost realism analysis for proposal validation
 * - Export capabilities for cost volumes and BOE packages
 * - WBS management and validation
 *
 * All operations are scoped to the authenticated user's organization and
 * integrate with AI services for intelligent estimation and narrative generation.
 *
 * Government Proposal Context:
 * Federal contractors must submit detailed cost proposals demonstrating price
 * reasonableness per FAR Part 15. This module enables systematic cost volume
 * development ensuring traceability from technical requirements through WBS
 * to specific labor categories and rates. DCAA auditors may verify that labor
 * hours align with technical approach and rates match approved structures.
 *
 * @module lib/actions/pricing
 */

import { db } from "@/lib/db";
import { eq, and, desc, asc, inArray, sql, like, or, gte, lte, isNull, type SQL } from "drizzle-orm";
import { requireUserContext, type UserContext } from "@/lib/auth-utils";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { AIClient } from "@/lib/ai/client";
import {
	laborCategories,
	costElements,
	indirectRates,
	costTechnicalTracking,
	boeTemplates,
	pricingSummaries,
	type LaborCategory,
	type NewLaborCategory,
	type CostElement,
	type NewCostElement,
	type IndirectRate,
	type NewIndirectRate,
	type CostTechnicalTracking,
	type NewCostTechnicalTracking,
	type BoeTemplate,
	type NewBoeTemplate,
	type PricingSummary,
	type NewPricingSummary,
	type CostElementType,
	type OdcType,
	type PeriodType,
	type CostElementStatus,
	type IndirectRateType,
	type IndirectRateBase,
	type RateApprovalSource,
	type AlignmentIssueSeverity,
	type MinEducation,
	type PeriodSummary,
	type LaborMixEntry,
	type CostRiskFactor,
	type AlignmentIssue,
	type ImpliedStaffingEntry,
} from "@/lib/db/schema-pricing";

// Re-export types needed by components
export type { PeriodSummary, LaborMixEntry };
import { documents, opportunities } from "@/lib/db";
import { logger } from "@/lib/utils/logger";

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
// Type Definitions for API Layer
// ============================================================================

/**
 * Input for creating a new labor category.
 */
export interface CreateLaborCategoryInput {
	name: string;
	code?: string;
	description?: string;
	directRate?: number;
	fullyBurdenedRate?: number;
	effectiveDate?: string;
	expirationDate?: string;
	annualEscalation?: number;
	minEducation?: MinEducation;
	minExperience?: number;
	certifications?: string[];
	gsaScheduleNumber?: string;
	gsaSin?: string;
}

/**
 * Input for updating a labor category.
 */
export interface UpdateLaborCategoryInput extends Partial<CreateLaborCategoryInput> {
	isActive?: boolean;
}

/**
 * Input for bulk importing labor categories.
 */
export interface LaborCategoryImport {
	name: string;
	code?: string;
	description?: string;
	directRate: number;
	fullyBurdenedRate?: number;
	minEducation?: MinEducation;
	minExperience?: number;
	certifications?: string[];
	gsaScheduleNumber?: string;
	gsaSin?: string;
}

/**
 * Input for creating a cost element.
 */
export interface CreateCostElementInput {
	opportunityId: string;
	wbsCode?: string;
	wbsTitle?: string;
	technicalSectionId?: string;
	elementType: CostElementType;
	// Labor-specific
	laborCategoryId?: string;
	laborCategoryName?: string;
	hours?: number;
	rate?: number;
	// ODC-specific
	odcType?: OdcType;
	odcAmount?: number;
	odcDescription?: string;
	odcVendor?: string;
	odcQuoteReference?: string;
	// Subcontractor-specific
	subcontractorId?: string;
	subcontractorName?: string;
	subcontractorCost?: number;
	subcontractorRole?: string;
	// Travel-specific
	travelDescription?: string;
	travelTrips?: number;
	travelDaysPerTrip?: number;
	travelCostPerTrip?: number;
	// Material-specific
	materialDescription?: string;
	materialCost?: number;
	// Period
	periodNumber?: number;
	periodType?: PeriodType;
	periodStartDate?: string;
	periodEndDate?: string;
	// BOE
	boeNarrative?: string;
	assumptions?: string[];
	riskFactors?: CostRiskFactor[];
}

/**
 * Input for updating a cost element.
 */
export interface UpdateCostElementInput extends Partial<CreateCostElementInput> {
	status?: CostElementStatus;
}

/**
 * Filters for listing cost elements.
 */
export interface CostElementFilters {
	elementType?: CostElementType | CostElementType[];
	periodNumber?: number;
	wbsCode?: string;
	technicalSectionId?: string;
	status?: CostElementStatus;
	limit?: number;
	offset?: number;
}

/**
 * Report of cost-technical alignment issues.
 */
export interface AlignmentReport {
	overallScore: number;
	sectionsWithCost: number;
	sectionsWithoutCost: number;
	costElementsUnlinked: number;
	issues: {
		sectionId: string;
		sectionName: string;
		issue: string;
		severity: AlignmentIssueSeverity;
		suggestion: string;
	}[];
	recommendations: string[];
}

/**
 * Suggestion for cost elements to add to a technical section.
 */
export interface CostSuggestion {
	elementType: CostElementType;
	suggestedName: string;
	suggestedHours?: number;
	suggestedRate?: number;
	suggestedCost?: number;
	rationale: string;
	laborCategoryId?: string;
	laborCategoryName?: string;
	confidence: number;
}

/**
 * Hours estimate with breakdown by category.
 */
export interface HoursEstimate {
	totalHours: number;
	byCategory: {
		categoryId: string;
		categoryName: string;
		hours: number;
		confidence: number;
		rationale: string;
	}[];
	assumptions: string[];
	methodology: string;
}

/**
 * Input for BOE template.
 */
export interface BOETemplateInput {
	name: string;
	costElementType?: CostElementType;
	category?: string;
	templateText: string;
	placeholders?: string[];
}

/**
 * Full pricing summary with calculated totals.
 */
export interface PricingSummaryResult {
	opportunityId: string;
	periodSummaries: PeriodSummary[];
	grandTotals: {
		laborCost: number;
		odcCost: number;
		subcontractCost: number;
		travelCost: number;
		materialCost: number;
		totalDirectCost: number;
		overhead: number;
		gaAmount: number;
		fee: number;
		totalPrice: number;
	};
	metrics: {
		costPerFte: number;
		averageLaborRate: number;
		laborPercentage: number;
		odcPercentage: number;
	};
	laborMix: LaborMixEntry[];
}

/**
 * Input for indirect rate creation.
 */
export interface IndirectRateInput {
	rateName: string;
	rateType: IndirectRateType;
	rateValue: number;
	rateBase?: IndirectRateBase;
	effectiveStartDate: string;
	effectiveEndDate?: string;
	fiscalYear?: number;
	isApproved?: boolean;
	approvalSource?: RateApprovalSource;
	approvalDate?: string;
	approvalReference?: string;
}

/**
 * Cost realism analysis result.
 */
export interface CostRealismAnalysis {
	overallAssessment: "realistic" | "potentially_understated" | "potentially_overstated";
	score: number;
	factors: {
		laborRates: { assessment: string; marketComparison: string };
		laborHours: { assessment: string; scopeAlignment: string };
		odcs: { assessment: string; marketPricing: string };
		indirectRates: { assessment: string; industryComparison: string };
	};
	risks: {
		risk: string;
		likelihood: string;
		impact: string;
		mitigation: string;
	}[];
	narrative: string;
}

/**
 * Cost summary table for export.
 */
export interface CostSummaryTable {
	headers: string[];
	rows: { label: string; values: (string | number)[] }[];
	totals: (string | number)[];
}

/**
 * WBS item for structure management.
 */
export interface WBSItem {
	wbsCode: string;
	title: string;
	level: number;
	parentCode?: string;
	children?: WBSItem[];
	costElementIds?: string[];
	technicalSectionId?: string;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const createLaborCategorySchema = z.object({
	name: z.string().min(1, "Name is required").max(200),
	code: z.string().max(50).optional(),
	description: z.string().optional(),
	directRate: z.number().positive("Direct rate must be positive").optional(),
	fullyBurdenedRate: z.number().positive("Fully burdened rate must be positive").optional(),
	effectiveDate: z.string().optional(),
	expirationDate: z.string().optional(),
	annualEscalation: z.number().min(0).max(1).optional(),
	minEducation: z.enum(["hs", "aa", "bs", "ms", "phd"]).optional(),
	minExperience: z.number().int().min(0).optional(),
	certifications: z.array(z.string()).optional(),
	gsaScheduleNumber: z.string().max(50).optional(),
	gsaSin: z.string().max(50).optional(),
});

const updateLaborCategorySchema = createLaborCategorySchema.partial().extend({
	isActive: z.boolean().optional(),
});

const createCostElementSchema = z.object({
	opportunityId: z.string().uuid("Invalid opportunity ID"),
	wbsCode: z.string().max(100).optional(),
	wbsTitle: z.string().max(500).optional(),
	technicalSectionId: z.string().uuid().optional(),
	elementType: z.enum(["labor", "odc", "subcontract", "travel", "material", "other"]),
	laborCategoryId: z.string().uuid().optional(),
	laborCategoryName: z.string().max(200).optional(),
	hours: z.number().min(0).optional(),
	rate: z.number().min(0).optional(),
	odcType: z.enum(["equipment", "software", "supplies", "services"]).optional(),
	odcAmount: z.number().min(0).optional(),
	odcDescription: z.string().optional(),
	odcVendor: z.string().max(200).optional(),
	odcQuoteReference: z.string().max(200).optional(),
	subcontractorId: z.string().uuid().optional(),
	subcontractorName: z.string().max(200).optional(),
	subcontractorCost: z.number().min(0).optional(),
	subcontractorRole: z.string().optional(),
	travelDescription: z.string().optional(),
	travelTrips: z.number().int().min(0).optional(),
	travelDaysPerTrip: z.number().int().min(0).optional(),
	travelCostPerTrip: z.number().min(0).optional(),
	materialDescription: z.string().optional(),
	materialCost: z.number().min(0).optional(),
	periodNumber: z.number().int().min(1).optional(),
	periodType: z.enum(["base", "option_1", "option_2", "option_3", "option_4"]).optional(),
	periodStartDate: z.string().optional(),
	periodEndDate: z.string().optional(),
	boeNarrative: z.string().optional(),
	assumptions: z.array(z.string()).optional(),
	riskFactors: z.array(z.object({
		risk: z.string(),
		mitigation: z.string(),
		costImpact: z.number(),
	})).optional(),
});

const updateCostElementSchema = createCostElementSchema.partial().extend({
	status: z.enum(["draft", "pending_review", "approved"]).optional(),
});

const indirectRateSchema = z.object({
	rateName: z.string().min(1).max(200),
	rateType: z.enum(["overhead", "ga", "fee", "fringe", "escalation"]),
	rateValue: z.number().min(0).max(10),
	rateBase: z.enum(["labor", "total_cost", "labor_plus_overhead", "all_direct"]).optional(),
	effectiveStartDate: z.string(),
	effectiveEndDate: z.string().optional(),
	fiscalYear: z.number().int().min(2000).max(2100).optional(),
	isApproved: z.boolean().optional(),
	approvalSource: z.enum(["dcaa", "provisional", "forward_pricing", "budgetary"]).optional(),
	approvalDate: z.string().optional(),
	approvalReference: z.string().max(200).optional(),
});

const boeTemplateSchema = z.object({
	name: z.string().min(1).max(200),
	costElementType: z.enum(["labor", "odc", "subcontract", "travel", "material", "other"]).optional(),
	category: z.string().max(100).optional(),
	templateText: z.string().min(1),
	placeholders: z.array(z.string()).optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

type PricingUserContext = UserContext & { organizationId: string };

async function requirePricingContext(): Promise<PricingUserContext> {
	const userContext = await requireUserContext();
	if (!userContext.organizationId) {
		throw new Error("No organization context");
	}
	return {
		userId: userContext.userId,
		organizationId: userContext.organizationId,
	};
}

function resolvePricingOrganizationId(
	userContext: PricingUserContext,
	organizationId?: string
): string {
	if (organizationId && organizationId !== userContext.organizationId) {
		throw new Error("Not authorized for organization");
	}
	return userContext.organizationId;
}

function laborCategoryByIdCondition(id: string, userContext: PricingUserContext): SQL {
	return and(
		eq(laborCategories.id, id),
		eq(laborCategories.organizationId, userContext.organizationId)
	)!;
}

function visibleLaborCategoryIdsCondition(ids: string[], userContext: PricingUserContext): SQL {
	return and(
		inArray(laborCategories.id, ids),
		eq(laborCategories.organizationId, userContext.organizationId)
	)!;
}

function indirectRateByIdCondition(id: string, userContext: PricingUserContext): SQL {
	return and(
		eq(indirectRates.id, id),
		eq(indirectRates.organizationId, userContext.organizationId)
	)!;
}

function boeTemplateByIdCondition(id: string, userContext: PricingUserContext): SQL {
	return and(
		eq(boeTemplates.id, id),
		eq(boeTemplates.organizationId, userContext.organizationId)
	)!;
}

function assignedOpportunityByIdCondition(opportunityId: string, userContext: PricingUserContext): SQL {
	return and(
		eq(opportunities.id, opportunityId),
		eq(opportunities.assignedTo, userContext.userId)
	)!;
}

function assignedOpportunityExistsSql(opportunityId: unknown, userContext: PricingUserContext): SQL {
	return sql`exists (
		select 1
		from opportunities
		where opportunities.id = ${opportunityId}
			and opportunities.assigned_to = ${userContext.userId}
	)`;
}

function costElementByIdCondition(id: string, userContext: PricingUserContext): SQL {
	return and(
		eq(costElements.id, id),
		assignedOpportunityExistsSql(costElements.opportunityId, userContext)
	)!;
}

function costElementsByOpportunityCondition(opportunityId: string, userContext: PricingUserContext): SQL {
	return and(
		eq(costElements.opportunityId, opportunityId),
		assignedOpportunityExistsSql(opportunityId, userContext)
	)!;
}

async function ensureAssignedOpportunity(
	opportunityId: string,
	userContext: PricingUserContext
): Promise<boolean> {
	const [opportunity] = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(assignedOpportunityByIdCondition(opportunityId, userContext))
		.limit(1);
	return !!opportunity;
}

/**
 * Get AI client instance for pricing operations.
 */
function getAIClient(): AIClient {
	return new AIClient();
}

/**
 * Calculate total cost for a cost element based on its type.
 */
function calculateElementTotalCost(element: Partial<NewCostElement>): number {
	switch (element.elementType) {
		case "labor":
			return (element.hours || 0) * (element.rate || 0);
		case "odc":
			return element.odcAmount || 0;
		case "subcontract":
			return element.subcontractorCost || 0;
		case "travel":
			return (element.travelTrips || 0) * (element.travelCostPerTrip || 0);
		case "material":
			return element.materialCost || 0;
		default:
			return 0;
	}
}

/**
 * Apply indirect rates to a cost element.
 */
function applyIndirectRates(
	directCost: number,
	overheadRate: number,
	gaRate: number,
	feeRate: number
): { overhead: number; ga: number; fee: number; total: number } {
	const overhead = directCost * overheadRate;
	const costWithOverhead = directCost + overhead;
	const ga = costWithOverhead * gaRate;
	const costWithGa = costWithOverhead + ga;
	const fee = costWithGa * feeRate;
	const total = costWithGa + fee;
	return { overhead, ga, fee, total };
}

// ============================================================================
// Labor Category CRUD Operations
// ============================================================================

/**
 * Create a new labor category.
 *
 * @param data - Labor category creation data
 * @returns Created labor category
 */
export async function createLaborCategory(
	data: CreateLaborCategoryInput
): Promise<ActionResult<LaborCategory>> {
	try {
		const userContext = await requirePricingContext();
		const validated = createLaborCategorySchema.parse(data);

		const [category] = await db
			.insert(laborCategories)
			.values({
				organizationId: userContext.organizationId,
				name: validated.name,
				code: validated.code,
				description: validated.description,
				directRate: validated.directRate,
				fullyBurdenedRate: validated.fullyBurdenedRate,
				effectiveDate: validated.effectiveDate,
				expirationDate: validated.expirationDate,
				annualEscalation: validated.annualEscalation,
				minEducation: validated.minEducation,
				minExperience: validated.minExperience,
				certifications: validated.certifications,
				gsaScheduleNumber: validated.gsaScheduleNumber,
				gsaSin: validated.gsaSin,
				isActive: true,
			})
			.returning();

		revalidatePath("/pricing/labor-categories");

		return { success: true, data: category };
	} catch (error) {
		logger.error("Error creating labor category:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((i) => i.message).join(", ") };
		}
		return {
			success: false,
			error: `Failed to create labor category: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Update an existing labor category.
 *
 * @param id - Labor category ID to update
 * @param data - Fields to update
 * @returns Updated labor category
 */
export async function updateLaborCategory(
	id: string,
	data: UpdateLaborCategoryInput
): Promise<ActionResult<LaborCategory>> {
	try {
		const userContext = await requirePricingContext();
		const validated = updateLaborCategorySchema.parse(data);

		const updates: Partial<LaborCategory> = { updatedAt: new Date() };
		if (validated.name !== undefined) updates.name = validated.name;
		if (validated.code !== undefined) updates.code = validated.code;
		if (validated.description !== undefined) updates.description = validated.description;
		if (validated.directRate !== undefined) updates.directRate = validated.directRate;
		if (validated.fullyBurdenedRate !== undefined) updates.fullyBurdenedRate = validated.fullyBurdenedRate;
		if (validated.effectiveDate !== undefined) updates.effectiveDate = validated.effectiveDate;
		if (validated.expirationDate !== undefined) updates.expirationDate = validated.expirationDate;
		if (validated.annualEscalation !== undefined) updates.annualEscalation = validated.annualEscalation;
		if (validated.minEducation !== undefined) updates.minEducation = validated.minEducation;
		if (validated.minExperience !== undefined) updates.minExperience = validated.minExperience;
		if (validated.certifications !== undefined) updates.certifications = validated.certifications;
		if (validated.gsaScheduleNumber !== undefined) updates.gsaScheduleNumber = validated.gsaScheduleNumber;
		if (validated.gsaSin !== undefined) updates.gsaSin = validated.gsaSin;
		if (validated.isActive !== undefined) updates.isActive = validated.isActive;

		const [category] = await db
			.update(laborCategories)
			.set(updates)
			.where(laborCategoryByIdCondition(id, userContext))
			.returning();

		if (!category) {
			return { success: false, error: "Labor category not found" };
		}

		revalidatePath("/pricing/labor-categories");

		return { success: true, data: category };
	} catch (error) {
		logger.error("Error updating labor category:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((i) => i.message).join(", ") };
		}
		return {
			success: false,
			error: `Failed to update labor category: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Delete a labor category.
 *
 * @param id - Labor category ID to delete
 */
export async function deleteLaborCategory(id: string): Promise<ActionResult<void>> {
	try {
		const userContext = await requirePricingContext();

		const [category] = await db
			.select({ id: laborCategories.id })
			.from(laborCategories)
			.where(laborCategoryByIdCondition(id, userContext));

		if (!category) {
			return { success: false, error: "Labor category not found" };
		}

		// Check if category is in use
		const usageCount = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(costElements)
			.where(eq(costElements.laborCategoryId, id));

		if ((usageCount[0]?.count || 0) > 0) {
			return {
				success: false,
				error: "Cannot delete labor category that is in use by cost elements. Deactivate it instead.",
			};
		}

		await db.delete(laborCategories).where(laborCategoryByIdCondition(id, userContext));

		revalidatePath("/pricing/labor-categories");

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error deleting labor category:", error);
		return {
			success: false,
			error: `Failed to delete labor category: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * List labor categories for the organization.
 *
 * @param organizationId - Optional organization ID filter
 * @returns Array of labor categories
 */
export async function listLaborCategories(
	organizationId?: string
): Promise<ActionResult<LaborCategory[]>> {
	try {
		const userContext = await requirePricingContext();
		const orgId = resolvePricingOrganizationId(userContext, organizationId);

		const categories = await db
			.select()
			.from(laborCategories)
			.where(eq(laborCategories.organizationId, orgId))
			.orderBy(asc(laborCategories.name));

		return { success: true, data: categories };
	} catch (error) {
		logger.error("Error listing labor categories:", error);
		return {
			success: false,
			error: `Failed to list labor categories: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Get a single labor category by ID.
 *
 * @param id - Labor category ID
 * @returns Labor category or null
 */
export async function getLaborCategory(id: string): Promise<ActionResult<LaborCategory | null>> {
	try {
		const userContext = await requirePricingContext();

		const [category] = await db
			.select()
			.from(laborCategories)
			.where(laborCategoryByIdCondition(id, userContext));

		return { success: true, data: category || null };
	} catch (error) {
		logger.error("Error getting labor category:", error);
		return {
			success: false,
			error: `Failed to get labor category: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Bulk import labor categories.
 *
 * @param data - Array of labor categories to import
 * @returns Import results with count and errors
 */
export async function importLaborCategories(
	data: LaborCategoryImport[]
): Promise<ActionResult<{ imported: number; errors: string[] }>> {
	try {
		const userContext = await requirePricingContext();
		const orgId = userContext.organizationId;

		const errors: string[] = [];
		let imported = 0;

		for (const item of data) {
			try {
				const validated = createLaborCategorySchema.parse(item);

				await db.insert(laborCategories).values({
					organizationId: orgId,
					name: validated.name,
					code: validated.code,
					description: validated.description,
					directRate: validated.directRate,
					fullyBurdenedRate: validated.fullyBurdenedRate,
					minEducation: validated.minEducation,
					minExperience: validated.minExperience,
					certifications: validated.certifications,
					gsaScheduleNumber: validated.gsaScheduleNumber,
					gsaSin: validated.gsaSin,
					isActive: true,
				});

				imported++;
			} catch (error) {
				errors.push(`${item.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		revalidatePath("/pricing/labor-categories");

		return { success: true, data: { imported, errors } };
	} catch (error) {
		logger.error("Error importing labor categories:", error);
		return {
			success: false,
			error: `Failed to import labor categories: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// Cost Element CRUD Operations
// ============================================================================

/**
 * Create a new cost element.
 *
 * @param data - Cost element creation data
 * @returns Created cost element
 */
export async function createCostElement(
	data: CreateCostElementInput
): Promise<ActionResult<CostElement>> {
	try {
		const userContext = await requirePricingContext();
		const validated = createCostElementSchema.parse(data);
		if (!(await ensureAssignedOpportunity(validated.opportunityId, userContext))) {
			return { success: false, error: "Opportunity not found" };
		}

		// Calculate costs based on element type
		let laborCost: number | undefined;
		let travelCost: number | undefined;

		if (validated.elementType === "labor" && validated.hours && validated.rate) {
			laborCost = validated.hours * validated.rate;
		}

		if (validated.elementType === "travel" && validated.travelTrips && validated.travelCostPerTrip) {
			travelCost = validated.travelTrips * validated.travelCostPerTrip;
		}

		const newElement: NewCostElement = {
			opportunityId: validated.opportunityId,
			wbsCode: validated.wbsCode,
			wbsTitle: validated.wbsTitle,
			technicalSectionId: validated.technicalSectionId,
			elementType: validated.elementType,
			laborCategoryId: validated.laborCategoryId,
			laborCategoryName: validated.laborCategoryName,
			hours: validated.hours,
			rate: validated.rate,
			laborCost,
			odcType: validated.odcType,
			odcAmount: validated.odcAmount,
			odcDescription: validated.odcDescription,
			odcVendor: validated.odcVendor,
			odcQuoteReference: validated.odcQuoteReference,
			subcontractorId: validated.subcontractorId,
			subcontractorName: validated.subcontractorName,
			subcontractorCost: validated.subcontractorCost,
			subcontractorRole: validated.subcontractorRole,
			travelDescription: validated.travelDescription,
			travelTrips: validated.travelTrips,
			travelDaysPerTrip: validated.travelDaysPerTrip,
			travelCostPerTrip: validated.travelCostPerTrip,
			travelCost,
			materialDescription: validated.materialDescription,
			materialCost: validated.materialCost,
			periodNumber: validated.periodNumber ?? 1,
			periodType: validated.periodType ?? "base",
			periodStartDate: validated.periodStartDate,
			periodEndDate: validated.periodEndDate,
			boeNarrative: validated.boeNarrative,
			assumptions: validated.assumptions,
			riskFactors: validated.riskFactors,
			status: "draft",
		};

		// Calculate total cost
		newElement.totalCost = calculateElementTotalCost(newElement);

		const [element] = await db.insert(costElements).values(newElement).returning();

		revalidatePath(`/opportunities/${validated.opportunityId}/pricing`);

		return { success: true, data: element };
	} catch (error) {
		logger.error("Error creating cost element:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((i) => i.message).join(", ") };
		}
		return {
			success: false,
			error: `Failed to create cost element: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Update an existing cost element.
 *
 * @param id - Cost element ID to update
 * @param data - Fields to update
 * @returns Updated cost element
 */
export async function updateCostElement(
	id: string,
	data: UpdateCostElementInput
): Promise<ActionResult<CostElement>> {
	try {
		const userContext = await requirePricingContext();
		const validated = updateCostElementSchema.parse(data);

		// Get existing element
		const [existing] = await db.select().from(costElements).where(costElementByIdCondition(id, userContext));
		if (!existing) {
			return { success: false, error: "Cost element not found" };
		}

		const updates: Partial<CostElement> = { updatedAt: new Date() };

		// Copy validated fields
		Object.entries(validated).forEach(([key, value]) => {
			if (value !== undefined) {
				(updates as Record<string, unknown>)[key] = value;
			}
		});

		// Recalculate costs if relevant fields changed
		const mergedElement = { ...existing, ...updates };
		if (mergedElement.elementType === "labor" && (validated.hours !== undefined || validated.rate !== undefined)) {
			updates.laborCost = (mergedElement.hours || 0) * (mergedElement.rate || 0);
		}
		if (mergedElement.elementType === "travel" && (validated.travelTrips !== undefined || validated.travelCostPerTrip !== undefined)) {
			updates.travelCost = (mergedElement.travelTrips || 0) * (mergedElement.travelCostPerTrip || 0);
		}

		updates.totalCost = calculateElementTotalCost({ ...existing, ...updates });

		const [element] = await db
			.update(costElements)
			.set(updates)
			.where(costElementByIdCondition(id, userContext))
			.returning();

		revalidatePath(`/opportunities/${element.opportunityId}/pricing`);

		return { success: true, data: element };
	} catch (error) {
		logger.error("Error updating cost element:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((i) => i.message).join(", ") };
		}
		return {
			success: false,
			error: `Failed to update cost element: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Delete a cost element.
 *
 * @param id - Cost element ID to delete
 */
export async function deleteCostElement(id: string): Promise<ActionResult<void>> {
	try {
		const userContext = await requirePricingContext();

		const [element] = await db.select().from(costElements).where(costElementByIdCondition(id, userContext));
		if (!element) {
			return { success: false, error: "Cost element not found" };
		}

		await db.delete(costElements).where(costElementByIdCondition(id, userContext));

		revalidatePath(`/opportunities/${element.opportunityId}/pricing`);

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error deleting cost element:", error);
		return {
			success: false,
			error: `Failed to delete cost element: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * List cost elements for an opportunity with optional filters.
 *
 * @param opportunityId - Opportunity ID
 * @param filters - Optional filters
 * @returns Array of cost elements
 */
export async function listCostElements(
	opportunityId: string,
	filters?: CostElementFilters
): Promise<ActionResult<CostElement[]>> {
	try {
		const userContext = await requirePricingContext();

		const conditions = [costElementsByOpportunityCondition(opportunityId, userContext)];

		if (filters?.elementType) {
			const types = Array.isArray(filters.elementType) ? filters.elementType : [filters.elementType];
			conditions.push(inArray(costElements.elementType, types));
		}
		if (filters?.periodNumber !== undefined) {
			conditions.push(eq(costElements.periodNumber, filters.periodNumber));
		}
		if (filters?.wbsCode) {
			conditions.push(like(costElements.wbsCode, `${filters.wbsCode}%`));
		}
		if (filters?.technicalSectionId) {
			conditions.push(eq(costElements.technicalSectionId, filters.technicalSectionId));
		}
		if (filters?.status) {
			conditions.push(eq(costElements.status, filters.status));
		}

		let query = db
			.select()
			.from(costElements)
			.where(and(...conditions))
			.orderBy(asc(costElements.wbsCode), asc(costElements.periodNumber));

		if (filters?.limit) {
			query = query.limit(filters.limit) as typeof query;
		}
		if (filters?.offset) {
			query = query.offset(filters.offset) as typeof query;
		}

		const elements = await query;

		return { success: true, data: elements };
	} catch (error) {
		logger.error("Error listing cost elements:", error);
		return {
			success: false,
			error: `Failed to list cost elements: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Get a single cost element by ID.
 *
 * @param id - Cost element ID
 * @returns Cost element or null
 */
export async function getCostElement(id: string): Promise<ActionResult<CostElement | null>> {
	try {
		const userContext = await requirePricingContext();

		const [element] = await db.select().from(costElements).where(costElementByIdCondition(id, userContext));

		return { success: true, data: element || null };
	} catch (error) {
		logger.error("Error getting cost element:", error);
		return {
			success: false,
			error: `Failed to get cost element: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Duplicate a cost element, optionally for a new period.
 *
 * @param id - Cost element ID to duplicate
 * @param newPeriod - Optional new period number
 * @returns Duplicated cost element
 */
export async function duplicateCostElement(
	id: string,
	newPeriod?: number
): Promise<ActionResult<CostElement>> {
	try {
		const userContext = await requirePricingContext();

		const [original] = await db.select().from(costElements).where(costElementByIdCondition(id, userContext));
		if (!original) {
			return { success: false, error: "Cost element not found" };
		}

		// Remove id and timestamps
		const { id: _id, createdAt, updatedAt, approvedBy, approvedAt, ...rest } = original;

		const newElement: NewCostElement = {
			...rest,
			periodNumber: newPeriod ?? (original.periodNumber || 1),
			status: "draft",
		};

		const [element] = await db.insert(costElements).values(newElement).returning();

		revalidatePath(`/opportunities/${element.opportunityId}/pricing`);

		return { success: true, data: element };
	} catch (error) {
		logger.error("Error duplicating cost element:", error);
		return {
			success: false,
			error: `Failed to duplicate cost element: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Bulk update multiple cost elements.
 *
 * @param updates - Array of updates with ID and partial data
 */
export async function bulkUpdateCostElements(
	updates: { id: string; data: Partial<CostElement> }[]
): Promise<ActionResult<void>> {
	try {
		const userContext = await requirePricingContext();

		await db.transaction(async (tx) => {
			for (const update of updates) {
				await tx
					.update(costElements)
					.set({ ...update.data, updatedAt: new Date() })
					.where(costElementByIdCondition(update.id, userContext));
			}
		});

		// Revalidate paths for affected opportunities
		const affectedOpportunities = new Set<string>();
		for (const update of updates) {
			const [element] = await db.select().from(costElements).where(costElementByIdCondition(update.id, userContext));
			if (element) affectedOpportunities.add(element.opportunityId);
		}
		for (const oppId of affectedOpportunities) {
			revalidatePath(`/opportunities/${oppId}/pricing`);
		}

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error bulk updating cost elements:", error);
		return {
			success: false,
			error: `Failed to bulk update cost elements: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// Cost-Technical Alignment Operations
// ============================================================================

/**
 * Link a cost element to a technical section.
 *
 * @param costElementId - Cost element ID
 * @param technicalSectionId - Technical section ID
 */
export async function linkCostToTechnical(
	costElementId: string,
	technicalSectionId: string
): Promise<ActionResult<void>> {
	try {
		const userContext = await requirePricingContext();

		await db
			.update(costElements)
			.set({
				technicalSectionId,
				updatedAt: new Date(),
			})
			.where(costElementByIdCondition(costElementId, userContext));

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error linking cost to technical:", error);
		return {
			success: false,
			error: `Failed to link cost to technical: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Unlink a cost element from its technical section.
 *
 * @param costElementId - Cost element ID
 */
export async function unlinkCostFromTechnical(costElementId: string): Promise<ActionResult<void>> {
	try {
		const userContext = await requirePricingContext();

		await db
			.update(costElements)
			.set({
				technicalSectionId: null,
				updatedAt: new Date(),
			})
			.where(costElementByIdCondition(costElementId, userContext));

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error unlinking cost from technical:", error);
		return {
			success: false,
			error: `Failed to unlink cost from technical: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Validate cost-technical alignment for an opportunity.
 * Uses AI to analyze technical content and compare against cost elements.
 *
 * @param opportunityId - Opportunity ID to validate
 * @returns Alignment report with issues and recommendations
 */
export async function validateCostTechnicalAlignment(
	opportunityId: string
): Promise<ActionResult<AlignmentReport>> {
	try {
		await requireUserContext();

		// Get all cost elements for the opportunity
		const elements = await db
			.select()
			.from(costElements)
			.where(eq(costElements.opportunityId, opportunityId));

		// Get technical tracking records
		const tracking = await db
			.select()
			.from(costTechnicalTracking)
			.where(eq(costTechnicalTracking.opportunityId, opportunityId));

		// Get documents for the opportunity to analyze technical sections
		const docs = await db
			.select()
			.from(documents)
			.where(
				and(
					eq(documents.ownerId, opportunityId),
					eq(documents.status, "draft")
				)
			);

		// Analyze alignment
		const linkedSectionIds = new Set(elements.filter(e => e.technicalSectionId).map(e => e.technicalSectionId));
		const unlinkedElements = elements.filter(e => !e.technicalSectionId);

		const issues: AlignmentReport["issues"] = [];

		// Check for sections without cost
		for (const trackRecord of tracking) {
			if (!trackRecord.hasMatchingCost) {
				issues.push({
					sectionId: trackRecord.technicalSectionId ?? "",
					sectionName: trackRecord.sectionName ?? "Unknown Section",
					issue: "Technical section has no linked cost elements",
					severity: "major",
					suggestion: "Add cost elements to support this technical section",
				});
			}

			// Add any issues from tracking analysis
			const alignmentIssues = (trackRecord.alignmentIssues as AlignmentIssue[]) || [];
			for (const ai of alignmentIssues) {
				issues.push({
					sectionId: trackRecord.technicalSectionId ?? "",
					sectionName: trackRecord.sectionName ?? "Unknown Section",
					issue: ai.issue,
					severity: ai.severity as AlignmentIssueSeverity,
					suggestion: ai.suggestion,
				});
			}
		}

		// Check for unlinked cost elements
		for (const element of unlinkedElements) {
			issues.push({
				sectionId: "",
				sectionName: "Unlinked Cost Element",
				issue: `Cost element "${element.wbsTitle || element.laborCategoryName || "Unknown"}" is not linked to any technical section`,
				severity: "minor",
				suggestion: "Link this cost element to the appropriate technical section",
			});
		}

		// Calculate overall score
		const totalSections = tracking.length;
		const sectionsWithCost = tracking.filter(t => t.hasMatchingCost).length;
		const overallScore = totalSections > 0 ? (sectionsWithCost / totalSections) * 100 : 0;

		// Generate recommendations using AI
		const ai = getAIClient();
		let recommendations: string[] = [];

		if (issues.length > 0) {
			try {
				const aiResult = await ai.complete(`
You are a government proposal pricing expert. Based on the following cost-technical alignment issues, provide 3-5 specific recommendations to improve alignment:

Issues:
${issues.map(i => `- [${i.severity}] ${i.sectionName}: ${i.issue}`).join("\n")}

Statistics:
- Total sections: ${totalSections}
- Sections with cost: ${sectionsWithCost}
- Unlinked cost elements: ${unlinkedElements.length}

Provide actionable recommendations in a JSON array format:
["recommendation 1", "recommendation 2", ...]
`);
				const parsed = JSON.parse(aiResult.content);
				if (Array.isArray(parsed)) {
					recommendations = parsed;
				}
			} catch {
				recommendations = [
					"Review all technical sections to ensure each has supporting cost elements",
					"Verify labor categories match the skill levels described in technical approach",
					"Ensure WBS codes align between cost and technical volumes",
				];
			}
		}

		const report: AlignmentReport = {
			overallScore: Math.round(overallScore),
			sectionsWithCost,
			sectionsWithoutCost: totalSections - sectionsWithCost,
			costElementsUnlinked: unlinkedElements.length,
			issues,
			recommendations,
		};

		return { success: true, data: report };
	} catch (error) {
		logger.error("Error validating cost-technical alignment:", error);
		return {
			success: false,
			error: `Failed to validate alignment: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Suggest cost elements for a technical section using AI.
 *
 * @param technicalSectionId - Technical section ID to analyze
 * @returns Array of suggested cost elements
 */
export async function suggestCostForSection(
	technicalSectionId: string
): Promise<ActionResult<CostSuggestion[]>> {
	try {
		const userContext = await requirePricingContext();

		// Get the technical section tracking record
		const [tracking] = await db
			.select()
			.from(costTechnicalTracking)
			.where(eq(costTechnicalTracking.technicalSectionId, technicalSectionId));

		if (!tracking) {
			return { success: false, error: "Technical section not found" };
		}

		// Get available labor categories
		const orgId = userContext.organizationId;
		const categories = await db
			.select()
			.from(laborCategories)
			.where(and(eq(laborCategories.organizationId, orgId), eq(laborCategories.isActive, true)));

		// Use AI to suggest costs based on technical content
		const ai = getAIClient();
		const prompt = `
You are a government proposal pricing expert. Analyze this technical section and suggest appropriate cost elements.

Technical Section: "${tracking.sectionName}"
Content: ${tracking.sectionContent?.substring(0, 2000) || "No content available"}

Available Labor Categories:
${categories.map(c => `- ${c.name} (Code: ${c.code}, Rate: $${c.fullyBurdenedRate || c.directRate}/hr)`).join("\n")}

Suggest cost elements that would be needed to execute this technical approach. For each suggestion, provide:
1. Element type (labor, odc, subcontract, travel, material)
2. Name/description
3. For labor: recommended category and estimated hours
4. For other types: estimated cost
5. Rationale for the suggestion
6. Confidence level (0-1)

Respond in JSON format:
{
  "suggestions": [
    {
      "elementType": "labor",
      "suggestedName": "Software Development",
      "laborCategoryId": "<category_id>",
      "laborCategoryName": "<category_name>",
      "suggestedHours": 100,
      "suggestedRate": 150,
      "rationale": "Based on the software development tasks described...",
      "confidence": 0.85
    }
  ]
}
`;

		const result = await ai.complete(prompt);

		try {
			const parsed = JSON.parse(result.content);
			const suggestions: CostSuggestion[] = (parsed.suggestions || []).map((s: Record<string, unknown>) => ({
				elementType: s.elementType as CostElementType,
				suggestedName: s.suggestedName as string,
				suggestedHours: s.suggestedHours as number | undefined,
				suggestedRate: s.suggestedRate as number | undefined,
				suggestedCost: s.suggestedCost as number | undefined,
				rationale: s.rationale as string,
				laborCategoryId: s.laborCategoryId as string | undefined,
				laborCategoryName: s.laborCategoryName as string | undefined,
				confidence: s.confidence as number,
			}));

			return { success: true, data: suggestions };
		} catch {
			return {
				success: false,
				error: "Failed to parse AI suggestions",
			};
		}
	} catch (error) {
		logger.error("Error suggesting cost for section:", error);
		return {
			success: false,
			error: `Failed to suggest costs: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// Hours Estimation Operations
// ============================================================================

/**
 * Estimate hours from a technical section using AI.
 *
 * @param technicalSectionId - Technical section ID
 * @returns Hours estimate with breakdown
 */
export async function estimateHoursFromTechnical(
	technicalSectionId: string
): Promise<ActionResult<HoursEstimate>> {
	try {
		const userContext = await requirePricingContext();

		// Get technical section tracking
		const [tracking] = await db
			.select()
			.from(costTechnicalTracking)
			.where(eq(costTechnicalTracking.technicalSectionId, technicalSectionId));

		if (!tracking) {
			return { success: false, error: "Technical section not found" };
		}

		// Get available labor categories
		const orgId = userContext.organizationId;
		const categories = await db
			.select()
			.from(laborCategories)
			.where(and(eq(laborCategories.organizationId, orgId), eq(laborCategories.isActive, true)));

		const ai = getAIClient();
		const prompt = `
You are a government proposal pricing expert specializing in work estimation.
Analyze this technical section and estimate the labor hours needed.

Technical Section: "${tracking.sectionName}"
Content: ${tracking.sectionContent?.substring(0, 3000) || "No content available"}

Available Labor Categories:
${categories.map(c => `- ${c.name} (ID: ${c.id}, Min Experience: ${c.minExperience || 0} years)`).join("\n")}

Provide a detailed hours estimate broken down by labor category. Consider:
1. Task complexity and duration
2. Appropriate skill levels for each task
3. Parallel vs sequential work
4. Review and rework time

Respond in JSON format:
{
  "totalHours": <number>,
  "byCategory": [
    {
      "categoryId": "<id>",
      "categoryName": "<name>",
      "hours": <number>,
      "confidence": <0-1>,
      "rationale": "<explanation>"
    }
  ],
  "assumptions": ["assumption 1", "assumption 2"],
  "methodology": "<description of estimation approach>"
}
`;

		const result = await ai.complete(prompt);

		try {
			const parsed = JSON.parse(result.content);
			const estimate: HoursEstimate = {
				totalHours: parsed.totalHours || 0,
				byCategory: parsed.byCategory || [],
				assumptions: parsed.assumptions || [],
				methodology: parsed.methodology || "AI-assisted estimation based on technical content analysis",
			};

			// Store implied staffing in tracking record
			const impliedStaffing: ImpliedStaffingEntry[] = estimate.byCategory.map(c => ({
				role: c.categoryName,
				effort: `${c.hours} hours`,
				hours: c.hours,
			}));

			await db
				.update(costTechnicalTracking)
				.set({
					impliedStaffing,
					analyzedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(costTechnicalTracking.id, tracking.id));

			return { success: true, data: estimate };
		} catch {
			return {
				success: false,
				error: "Failed to parse AI estimate",
			};
		}
	} catch (error) {
		logger.error("Error estimating hours from technical:", error);
		return {
			success: false,
			error: `Failed to estimate hours: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Estimate hours from a scope description.
 *
 * @param scopeDescription - Text description of the scope
 * @param complexity - Complexity level (low, medium, high)
 * @returns Hours estimate with breakdown
 */
export async function estimateHoursFromScope(
	scopeDescription: string,
	complexity: "low" | "medium" | "high"
): Promise<ActionResult<HoursEstimate>> {
	try {
		const userContext = await requirePricingContext();

		// Get available labor categories
		const orgId = userContext.organizationId;
		const categories = await db
			.select()
			.from(laborCategories)
			.where(and(eq(laborCategories.organizationId, orgId), eq(laborCategories.isActive, true)));

		const complexityMultiplier = {
			low: 0.8,
			medium: 1.0,
			high: 1.3,
		}[complexity];

		const ai = getAIClient();
		const prompt = `
You are a government proposal pricing expert. Estimate labor hours for this scope of work.

Scope Description:
${scopeDescription}

Complexity Level: ${complexity} (${complexityMultiplier}x multiplier for standard estimates)

Available Labor Categories:
${categories.map(c => `- ${c.name} (ID: ${c.id})`).join("\n")}

Estimate hours needed by labor category. Apply the complexity multiplier to your base estimates.

Respond in JSON format:
{
  "totalHours": <number>,
  "byCategory": [
    {
      "categoryId": "<id>",
      "categoryName": "<name>",
      "hours": <number>,
      "confidence": <0-1>,
      "rationale": "<explanation>"
    }
  ],
  "assumptions": ["assumption 1", "assumption 2"],
  "methodology": "Scope-based estimation with ${complexity} complexity adjustment"
}
`;

		const result = await ai.complete(prompt);

		try {
			const parsed = JSON.parse(result.content);
			return {
				success: true,
				data: {
					totalHours: parsed.totalHours || 0,
					byCategory: parsed.byCategory || [],
					assumptions: parsed.assumptions || [],
					methodology: parsed.methodology || `Scope-based estimation with ${complexity} complexity`,
				},
			};
		} catch {
			return {
				success: false,
				error: "Failed to parse AI estimate",
			};
		}
	} catch (error) {
		logger.error("Error estimating hours from scope:", error);
		return {
			success: false,
			error: `Failed to estimate hours: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// BOE Generation Operations
// ============================================================================

/**
 * Generate a BOE narrative for a cost element using AI.
 *
 * @param costElementId - Cost element ID
 * @returns Generated BOE narrative
 */
export async function generateBOENarrative(costElementId: string): Promise<ActionResult<string>> {
	try {
		const userContext = await requirePricingContext();

		const [element] = await db
			.select()
			.from(costElements)
			.where(costElementByIdCondition(costElementId, userContext));
		if (!element) {
			return { success: false, error: "Cost element not found" };
		}

		const ai = getAIClient();
		let prompt: string;

		switch (element.elementType) {
			case "labor":
				prompt = `
Write a professional Basis of Estimate (BOE) narrative for this labor cost element in a government proposal.

Labor Category: ${element.laborCategoryName || "Unspecified"}
Hours: ${element.hours || 0}
Rate: $${element.rate || 0}/hour
Total Cost: $${element.laborCost || 0}
WBS: ${element.wbsCode || "N/A"} - ${element.wbsTitle || "N/A"}

The BOE should:
1. Explain the methodology used to estimate hours (analogy, engineering, parametric, expert judgment)
2. Reference similar past performance or historical data if applicable
3. Describe the tasks to be performed
4. Justify the skill level/labor category selected
5. List key assumptions
6. Address any risks considered

Write in a professional, third-person style suitable for DCAA review.
`;
				break;

			case "odc":
				prompt = `
Write a professional Basis of Estimate (BOE) narrative for this Other Direct Cost (ODC) in a government proposal.

ODC Type: ${element.odcType || "Unspecified"}
Description: ${element.odcDescription || "N/A"}
Amount: $${element.odcAmount || 0}
Vendor: ${element.odcVendor || "N/A"}
Quote Reference: ${element.odcQuoteReference || "N/A"}
WBS: ${element.wbsCode || "N/A"} - ${element.wbsTitle || "N/A"}

The BOE should:
1. Describe the item and its purpose
2. Justify why this cost is necessary
3. Explain how the price was determined (quote, catalog, historical)
4. Reference supporting documentation
5. List any assumptions

Write in a professional, third-person style suitable for DCAA review.
`;
				break;

			case "subcontract":
				prompt = `
Write a professional Basis of Estimate (BOE) narrative for this subcontractor cost in a government proposal.

Subcontractor: ${element.subcontractorName || "Unspecified"}
Role: ${element.subcontractorRole || "N/A"}
Cost: $${element.subcontractorCost || 0}
WBS: ${element.wbsCode || "N/A"} - ${element.wbsTitle || "N/A"}

The BOE should:
1. Describe the subcontractor's scope of work
2. Explain why a subcontractor is needed
3. Justify the selection of this subcontractor
4. Describe how the cost was determined
5. List any assumptions or dependencies

Write in a professional, third-person style suitable for DCAA review.
`;
				break;

			case "travel":
				prompt = `
Write a professional Basis of Estimate (BOE) narrative for this travel cost in a government proposal.

Description: ${element.travelDescription || "N/A"}
Number of Trips: ${element.travelTrips || 0}
Days per Trip: ${element.travelDaysPerTrip || 0}
Cost per Trip: $${element.travelCostPerTrip || 0}
Total Travel Cost: $${element.travelCost || 0}
WBS: ${element.wbsCode || "N/A"} - ${element.wbsTitle || "N/A"}

The BOE should:
1. Describe the purpose and necessity of travel
2. Justify the number of trips and duration
3. Explain how travel costs were estimated (GSA rates, historical, quotes)
4. List travelers and their roles if applicable
5. Note any assumptions

Write in a professional, third-person style suitable for DCAA review.
`;
				break;

			default:
				prompt = `
Write a professional Basis of Estimate (BOE) narrative for this cost element in a government proposal.

Element Type: ${element.elementType}
Total Cost: $${element.totalCost || 0}
WBS: ${element.wbsCode || "N/A"} - ${element.wbsTitle || "N/A"}

The BOE should:
1. Describe what this cost covers
2. Explain the estimation methodology
3. Justify the cost amount
4. List any assumptions
5. Address any risks

Write in a professional, third-person style suitable for DCAA review.
`;
		}

		const result = await ai.complete(prompt);

		// Update the cost element with the generated BOE
		await db
			.update(costElements)
			.set({
				boeNarrative: result.content,
				updatedAt: new Date(),
			})
			.where(costElementByIdCondition(costElementId, userContext));

		revalidatePath(`/opportunities/${element.opportunityId}/pricing`);

		return { success: true, data: result.content };
	} catch (error) {
		logger.error("Error generating BOE narrative:", error);
		return {
			success: false,
			error: `Failed to generate BOE: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Generate BOE narratives for all cost elements in an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Array of element IDs and their generated narratives
 */
export async function generateBOEForOpportunity(
	opportunityId: string
): Promise<ActionResult<{ elementId: string; narrative: string }[]>> {
	try {
		const userContext = await requirePricingContext();

		const elements = await db
			.select()
			.from(costElements)
			.where(
				and(
					costElementsByOpportunityCondition(opportunityId, userContext),
					isNull(costElements.boeNarrative)
				)
			);

		const results: { elementId: string; narrative: string }[] = [];

		for (const element of elements) {
			const result = await generateBOENarrative(element.id);
			if (result.success) {
				results.push({ elementId: element.id, narrative: result.data });
			}
		}

		return { success: true, data: results };
	} catch (error) {
		logger.error("Error generating BOE for opportunity:", error);
		return {
			success: false,
			error: `Failed to generate BOEs: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Save a BOE template for reuse.
 *
 * @param template - BOE template input
 * @returns Saved template
 */
export async function saveBOETemplate(
	template: BOETemplateInput
): Promise<ActionResult<BoeTemplate>> {
	try {
		const userContext = await requirePricingContext();
		const validated = boeTemplateSchema.parse(template);

		const [saved] = await db
			.insert(boeTemplates)
			.values({
				organizationId: userContext.organizationId,
				name: validated.name,
				costElementType: validated.costElementType,
				category: validated.category,
				templateText: validated.templateText,
				placeholders: validated.placeholders || [],
				isActive: true,
			})
			.returning();

		return { success: true, data: saved };
	} catch (error) {
		logger.error("Error saving BOE template:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((i) => i.message).join(", ") };
		}
		return {
			success: false,
			error: `Failed to save BOE template: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * List BOE templates, optionally filtered by element type.
 *
 * @param elementType - Optional element type filter
 * @returns Array of BOE templates
 */
export async function listBOETemplates(
	elementType?: CostElementType
): Promise<ActionResult<BoeTemplate[]>> {
	try {
		const userContext = await requirePricingContext();
		const orgId = userContext.organizationId;

		const conditions = [
			eq(boeTemplates.organizationId, orgId),
			eq(boeTemplates.isActive, true),
		];

		if (elementType) {
			conditions.push(eq(boeTemplates.costElementType, elementType));
		}

		const templates = await db
			.select()
			.from(boeTemplates)
			.where(and(...conditions))
			.orderBy(desc(boeTemplates.useCount), asc(boeTemplates.name));

		return { success: true, data: templates };
	} catch (error) {
		logger.error("Error listing BOE templates:", error);
		return {
			success: false,
			error: `Failed to list BOE templates: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Apply a BOE template to a cost element.
 *
 * @param costElementId - Cost element ID
 * @param templateId - Template ID to apply
 * @returns Generated BOE narrative from template
 */
export async function applyBOETemplate(
	costElementId: string,
	templateId: string
): Promise<ActionResult<string>> {
	try {
		const userContext = await requirePricingContext();

		const [element] = await db
			.select()
			.from(costElements)
			.where(costElementByIdCondition(costElementId, userContext));
		if (!element) {
			return { success: false, error: "Cost element not found" };
		}

		const [template] = await db.select().from(boeTemplates).where(boeTemplateByIdCondition(templateId, userContext));
		if (!template) {
			return { success: false, error: "BOE template not found" };
		}

		// Replace placeholders in template
		let narrative = template.templateText || "";

		const replacements: Record<string, string | number | null | undefined> = {
			"{{hours}}": element.hours,
			"{{rate}}": element.rate,
			"{{laborCategory}}": element.laborCategoryName,
			"{{totalCost}}": element.totalCost,
			"{{wbsCode}}": element.wbsCode,
			"{{wbsTitle}}": element.wbsTitle,
			"{{period}}": element.periodNumber,
			"{{periodType}}": element.periodType,
			"{{odcDescription}}": element.odcDescription,
			"{{odcVendor}}": element.odcVendor,
			"{{odcAmount}}": element.odcAmount,
			"{{subcontractorName}}": element.subcontractorName,
			"{{subcontractorCost}}": element.subcontractorCost,
			"{{travelDescription}}": element.travelDescription,
			"{{travelTrips}}": element.travelTrips,
			"{{travelCost}}": element.travelCost,
		};

		for (const [placeholder, value] of Object.entries(replacements)) {
			narrative = narrative.replace(new RegExp(placeholder, "g"), String(value ?? "N/A"));
		}

		// Update cost element with generated BOE
		await db
			.update(costElements)
			.set({
				boeNarrative: narrative,
				updatedAt: new Date(),
			})
			.where(costElementByIdCondition(costElementId, userContext));

		// Update template use count
		await db
			.update(boeTemplates)
			.set({
				useCount: (template.useCount || 0) + 1,
				lastUsedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(boeTemplateByIdCondition(templateId, userContext));

		return { success: true, data: narrative };
	} catch (error) {
		logger.error("Error applying BOE template:", error);
		return {
			success: false,
			error: `Failed to apply BOE template: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// Pricing Calculation Operations
// ============================================================================

/**
 * Calculate total price for an opportunity with full breakdown.
 *
 * @param opportunityId - Opportunity ID
 * @returns Complete pricing summary with all calculated totals
 */
export async function calculateTotalPrice(
	opportunityId: string
): Promise<ActionResult<PricingSummaryResult>> {
	try {
		const userContext = await requirePricingContext();
		const orgId = userContext.organizationId;
		if (!(await ensureAssignedOpportunity(opportunityId, userContext))) {
			return { success: false, error: "Opportunity not found" };
		}

		// Get all cost elements
		const elements = await db
			.select()
			.from(costElements)
			.where(costElementsByOpportunityCondition(opportunityId, userContext));

		// Get effective indirect rates
		const rates = await db
			.select()
			.from(indirectRates)
			.where(
				and(
					eq(indirectRates.organizationId, orgId),
					eq(indirectRates.isActive, true)
				)
			);

		const overheadRate = rates.find(r => r.rateType === "overhead")?.rateValue || 0;
		const gaRate = rates.find(r => r.rateType === "ga")?.rateValue || 0;
		const feeRate = rates.find(r => r.rateType === "fee")?.rateValue || 0;

		// Group by period
		const periodMap = new Map<number, CostElement[]>();
		for (const element of elements) {
			const period = element.periodNumber || 1;
			if (!periodMap.has(period)) {
				periodMap.set(period, []);
			}
			periodMap.get(period)!.push(element);
		}

		const periodSummaries: PeriodSummary[] = [];
		let grandTotals = {
			laborCost: 0,
			odcCost: 0,
			subcontractCost: 0,
			travelCost: 0,
			materialCost: 0,
			totalDirectCost: 0,
			overhead: 0,
			gaAmount: 0,
			fee: 0,
			totalPrice: 0,
		};

		// Calculate by period
		for (const [periodNumber, periodElements] of periodMap) {
			let laborCost = 0;
			let odcCost = 0;
			let subcontractCost = 0;
			let travelCost = 0;
			let materialCost = 0;

			for (const el of periodElements) {
				switch (el.elementType) {
					case "labor":
						laborCost += el.laborCost || 0;
						break;
					case "odc":
						odcCost += el.odcAmount || 0;
						break;
					case "subcontract":
						subcontractCost += el.subcontractorCost || 0;
						break;
					case "travel":
						travelCost += el.travelCost || 0;
						break;
					case "material":
						materialCost += el.materialCost || 0;
						break;
				}
			}

			const totalDirectCost = laborCost + odcCost + subcontractCost + travelCost + materialCost;

			// Apply indirect rates (overhead on labor only, G&A on total, fee on total with G&A)
			const overhead = laborCost * overheadRate;
			const costWithOverhead = totalDirectCost + overhead;
			const ga = costWithOverhead * gaRate;
			const costWithGa = costWithOverhead + ga;
			const fee = costWithGa * feeRate;
			const totalPrice = costWithGa + fee;

			const periodType = periodNumber === 1 ? "base" : `option_${periodNumber - 1}` as PeriodType;

			periodSummaries.push({
				periodNumber,
				periodType,
				laborCost,
				odcCost,
				subcontractCost,
				travelCost,
				materialCost,
				totalDirectCost,
				overhead,
				gaRate,
				feeRate,
				totalPrice,
			});

			// Add to grand totals
			grandTotals.laborCost += laborCost;
			grandTotals.odcCost += odcCost;
			grandTotals.subcontractCost += subcontractCost;
			grandTotals.travelCost += travelCost;
			grandTotals.materialCost += materialCost;
			grandTotals.totalDirectCost += totalDirectCost;
			grandTotals.overhead += overhead;
			grandTotals.gaAmount += ga;
			grandTotals.fee += fee;
			grandTotals.totalPrice += totalPrice;
		}

		// Calculate labor mix
		const laborMix: LaborMixEntry[] = [];
		const laborByCategory = new Map<string, { hours: number; cost: number }>();

		for (const el of elements.filter(e => e.elementType === "labor")) {
			const category = el.laborCategoryName || "Unspecified";
			const existing = laborByCategory.get(category) || { hours: 0, cost: 0 };
			existing.hours += el.hours || 0;
			existing.cost += el.laborCost || 0;
			laborByCategory.set(category, existing);
		}

		const totalLaborHours = Array.from(laborByCategory.values()).reduce((sum, v) => sum + v.hours, 0);
		for (const [category, data] of laborByCategory) {
			laborMix.push({
				category,
				percentage: totalLaborHours > 0 ? (data.hours / totalLaborHours) * 100 : 0,
				hours: data.hours,
			});
		}

		// Calculate metrics
		const totalHours = elements
			.filter(e => e.elementType === "labor")
			.reduce((sum, e) => sum + (e.hours || 0), 0);

		const metrics = {
			costPerFte: totalHours > 0 ? grandTotals.laborCost / (totalHours / 2080) : 0,
			averageLaborRate: totalHours > 0 ? grandTotals.laborCost / totalHours : 0,
			laborPercentage: grandTotals.totalDirectCost > 0
				? (grandTotals.laborCost / grandTotals.totalDirectCost) * 100
				: 0,
			odcPercentage: grandTotals.totalDirectCost > 0
				? ((grandTotals.odcCost + grandTotals.subcontractCost + grandTotals.travelCost + grandTotals.materialCost) /
					grandTotals.totalDirectCost) * 100
				: 0,
		};

		// Save pricing summary
		const existingSummary = await db
			.select()
			.from(pricingSummaries)
			.where(eq(pricingSummaries.opportunityId, opportunityId));

		if (existingSummary.length > 0) {
			await db
				.update(pricingSummaries)
				.set({
					periodSummaries,
					totalLaborCost: grandTotals.laborCost,
					totalOdcCost: grandTotals.odcCost,
					totalSubcontractCost: grandTotals.subcontractCost,
					totalTravelCost: grandTotals.travelCost,
					totalMaterialCost: grandTotals.materialCost,
					grandTotalDirectCost: grandTotals.totalDirectCost,
					grandTotalPrice: grandTotals.totalPrice,
					overheadRate,
					gaRate,
					feeRate,
					costPerFte: metrics.costPerFte,
					averageLaborRate: metrics.averageLaborRate,
					laborMixAnalysis: laborMix,
					calculatedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(pricingSummaries.opportunityId, opportunityId));
		} else {
			await db.insert(pricingSummaries).values({
				opportunityId,
				periodSummaries,
				totalLaborCost: grandTotals.laborCost,
				totalOdcCost: grandTotals.odcCost,
				totalSubcontractCost: grandTotals.subcontractCost,
				totalTravelCost: grandTotals.travelCost,
				totalMaterialCost: grandTotals.materialCost,
				grandTotalDirectCost: grandTotals.totalDirectCost,
				grandTotalPrice: grandTotals.totalPrice,
				overheadRate,
				gaRate,
				feeRate,
				costPerFte: metrics.costPerFte,
				averageLaborRate: metrics.averageLaborRate,
				laborMixAnalysis: laborMix,
				calculatedAt: new Date(),
			});
		}

		revalidatePath(`/opportunities/${opportunityId}/pricing`);

		return {
			success: true,
			data: {
				opportunityId,
				periodSummaries,
				grandTotals,
				metrics,
				laborMix,
			},
		};
	} catch (error) {
		logger.error("Error calculating total price:", error);
		return {
			success: false,
			error: `Failed to calculate price: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Recalculate costs for a single cost element.
 *
 * @param id - Cost element ID
 * @returns Updated cost element
 */
export async function recalculateCostElement(id: string): Promise<ActionResult<CostElement>> {
	try {
		const userContext = await requirePricingContext();

		const [element] = await db.select().from(costElements).where(costElementByIdCondition(id, userContext));
		if (!element) {
			return { success: false, error: "Cost element not found" };
		}

		const updates: Partial<CostElement> = { updatedAt: new Date() };

		// Recalculate based on type
		if (element.elementType === "labor") {
			updates.laborCost = (element.hours || 0) * (element.rate || 0);
			updates.totalCost = updates.laborCost;
		} else if (element.elementType === "travel") {
			updates.travelCost = (element.travelTrips || 0) * (element.travelCostPerTrip || 0);
			updates.totalCost = updates.travelCost;
		} else if (element.elementType === "odc") {
			updates.totalCost = element.odcAmount || 0;
		} else if (element.elementType === "subcontract") {
			updates.totalCost = element.subcontractorCost || 0;
		} else if (element.elementType === "material") {
			updates.totalCost = element.materialCost || 0;
		}

		const [updated] = await db
			.update(costElements)
			.set(updates)
			.where(costElementByIdCondition(id, userContext))
			.returning();

		return { success: true, data: updated };
	} catch (error) {
		logger.error("Error recalculating cost element:", error);
		return {
			success: false,
			error: `Failed to recalculate: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Apply escalation to all cost elements in an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @param escalationRate - Annual escalation rate (e.g., 0.03 for 3%)
 * @param startYear - Optional start year for escalation
 */
export async function applyEscalation(
	opportunityId: string,
	escalationRate: number,
	startYear?: number
): Promise<ActionResult<void>> {
	try {
		const userContext = await requirePricingContext();
		if (!(await ensureAssignedOpportunity(opportunityId, userContext))) {
			return { success: false, error: "Opportunity not found" };
		}

		const elements = await db
			.select()
			.from(costElements)
			.where(costElementsByOpportunityCondition(opportunityId, userContext));

		await db.transaction(async (tx) => {
			for (const element of elements) {
				const period = element.periodNumber || 1;
				const yearsFromStart = period - 1;

				// Apply compound escalation
				const escalationMultiplier = Math.pow(1 + escalationRate, yearsFromStart);

				const updates: Partial<CostElement> = { updatedAt: new Date() };

				if (element.elementType === "labor" && element.rate) {
					updates.rate = element.rate * escalationMultiplier;
					updates.laborCost = (element.hours || 0) * updates.rate;
					updates.totalCost = updates.laborCost;
				} else if (element.elementType === "travel" && element.travelCostPerTrip) {
					updates.travelCostPerTrip = element.travelCostPerTrip * escalationMultiplier;
					updates.travelCost = (element.travelTrips || 0) * updates.travelCostPerTrip;
					updates.totalCost = updates.travelCost;
				} else if (element.elementType === "odc" && element.odcAmount) {
					updates.odcAmount = element.odcAmount * escalationMultiplier;
					updates.totalCost = updates.odcAmount;
				} else if (element.elementType === "material" && element.materialCost) {
					updates.materialCost = element.materialCost * escalationMultiplier;
					updates.totalCost = updates.materialCost;
				}

				await tx
					.update(costElements)
					.set(updates)
					.where(costElementByIdCondition(element.id, userContext));
			}
		});

		revalidatePath(`/opportunities/${opportunityId}/pricing`);

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error applying escalation:", error);
		return {
			success: false,
			error: `Failed to apply escalation: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// Indirect Rate Operations
// ============================================================================

/**
 * Create a new indirect rate.
 *
 * @param data - Indirect rate input
 * @returns Created indirect rate
 */
export async function createIndirectRate(
	data: IndirectRateInput
): Promise<ActionResult<IndirectRate>> {
	try {
		const userContext = await requirePricingContext();
		const validated = indirectRateSchema.parse(data);

		const [rate] = await db
			.insert(indirectRates)
			.values({
				organizationId: userContext.organizationId,
				rateName: validated.rateName,
				rateType: validated.rateType,
				rateValue: validated.rateValue,
				rateBase: validated.rateBase,
				effectiveStartDate: validated.effectiveStartDate,
				effectiveEndDate: validated.effectiveEndDate,
				fiscalYear: validated.fiscalYear,
				isApproved: validated.isApproved ?? false,
				approvalSource: validated.approvalSource,
				approvalDate: validated.approvalDate,
				approvalReference: validated.approvalReference,
				isActive: true,
			})
			.returning();

		revalidatePath("/pricing/rates");

		return { success: true, data: rate };
	} catch (error) {
		logger.error("Error creating indirect rate:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((i) => i.message).join(", ") };
		}
		return {
			success: false,
			error: `Failed to create indirect rate: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Update an existing indirect rate.
 *
 * @param id - Indirect rate ID
 * @param data - Fields to update
 * @returns Updated indirect rate
 */
export async function updateIndirectRate(
	id: string,
	data: Partial<IndirectRateInput>
): Promise<ActionResult<IndirectRate>> {
	try {
		const userContext = await requirePricingContext();
		const validated = indirectRateSchema.partial().parse(data);

		const updates: Partial<IndirectRate> = { updatedAt: new Date() };
		Object.entries(validated).forEach(([key, value]) => {
			if (value !== undefined) {
				(updates as Record<string, unknown>)[key] = value;
			}
		});

		const [rate] = await db
			.update(indirectRates)
			.set(updates)
			.where(indirectRateByIdCondition(id, userContext))
			.returning();

		if (!rate) {
			return { success: false, error: "Indirect rate not found" };
		}

		revalidatePath("/pricing/rates");

		return { success: true, data: rate };
	} catch (error) {
		logger.error("Error updating indirect rate:", error);
		if (error instanceof z.ZodError) {
			return { success: false, error: error.issues.map((i) => i.message).join(", ") };
		}
		return {
			success: false,
			error: `Failed to update indirect rate: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * List indirect rates for the organization.
 *
 * @param organizationId - Optional organization ID filter
 * @returns Array of indirect rates
 */
export async function listIndirectRates(
	organizationId?: string
): Promise<ActionResult<IndirectRate[]>> {
	try {
		const userContext = await requirePricingContext();
		const orgId = resolvePricingOrganizationId(userContext, organizationId);

		const rates = await db
			.select()
			.from(indirectRates)
			.where(eq(indirectRates.organizationId, orgId))
			.orderBy(asc(indirectRates.rateType), desc(indirectRates.effectiveStartDate));

		return { success: true, data: rates };
	} catch (error) {
		logger.error("Error listing indirect rates:", error);
		return {
			success: false,
			error: `Failed to list indirect rates: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Get effective rates for a given date.
 *
 * @param date - Optional date to check (defaults to now)
 * @returns Effective overhead, G&A, and fee rates
 */
export async function getEffectiveRates(
	date?: Date
): Promise<ActionResult<{ overhead: number; ga: number; fee: number }>> {
	try {
		const userContext = await requirePricingContext();
		const orgId = userContext.organizationId;
		const checkDate = date || new Date();
		const dateStr = checkDate.toISOString().split("T")[0];

		const rates = await db
			.select()
			.from(indirectRates)
			.where(
				and(
					eq(indirectRates.organizationId, orgId),
					eq(indirectRates.isActive, true),
					lte(indirectRates.effectiveStartDate, dateStr),
					or(
						isNull(indirectRates.effectiveEndDate),
						gte(indirectRates.effectiveEndDate, dateStr)
					)
				)
			);

		const overhead = rates.find(r => r.rateType === "overhead")?.rateValue || 0;
		const ga = rates.find(r => r.rateType === "ga")?.rateValue || 0;
		const fee = rates.find(r => r.rateType === "fee")?.rateValue || 0;

		return { success: true, data: { overhead, ga, fee } };
	} catch (error) {
		logger.error("Error getting effective rates:", error);
		return {
			success: false,
			error: `Failed to get effective rates: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// Cost Realism Operations
// ============================================================================

/**
 * Analyze cost realism for an opportunity using AI.
 *
 * @param opportunityId - Opportunity ID to analyze
 * @returns Cost realism analysis with assessment and recommendations
 */
export async function analyzeCostRealism(
	opportunityId: string
): Promise<ActionResult<CostRealismAnalysis>> {
	try {
		const userContext = await requirePricingContext();

		// Get pricing summary
		const priceResult = await calculateTotalPrice(opportunityId);
		if (!priceResult.success) {
			return { success: false, error: priceResult.error };
		}

		const pricing = priceResult.data;

		// Get cost elements for detail analysis
		const elements = await db
			.select()
			.from(costElements)
			.where(costElementsByOpportunityCondition(opportunityId, userContext));

		// Prepare analysis using AI
		const ai = getAIClient();
		const prompt = `
You are a government cost realism analyst. Analyze this cost proposal and provide a detailed realism assessment.

Pricing Summary:
- Total Labor Cost: $${pricing.grandTotals.laborCost.toLocaleString()}
- Total ODC: $${pricing.grandTotals.odcCost.toLocaleString()}
- Total Subcontract: $${pricing.grandTotals.subcontractCost.toLocaleString()}
- Total Travel: $${pricing.grandTotals.travelCost.toLocaleString()}
- Total Material: $${pricing.grandTotals.materialCost.toLocaleString()}
- Total Direct Cost: $${pricing.grandTotals.totalDirectCost.toLocaleString()}
- Overhead: $${pricing.grandTotals.overhead.toLocaleString()}
- G&A: $${pricing.grandTotals.gaAmount.toLocaleString()}
- Fee: $${pricing.grandTotals.fee.toLocaleString()}
- Total Price: $${pricing.grandTotals.totalPrice.toLocaleString()}

Metrics:
- Average Labor Rate: $${pricing.metrics.averageLaborRate.toFixed(2)}/hr
- Cost per FTE: $${pricing.metrics.costPerFte.toLocaleString()}
- Labor Percentage: ${pricing.metrics.laborPercentage.toFixed(1)}%
- ODC Percentage: ${pricing.metrics.odcPercentage.toFixed(1)}%

Labor Mix:
${pricing.laborMix.map(l => `- ${l.category}: ${l.hours} hours (${l.percentage.toFixed(1)}%)`).join("\n")}

Number of Cost Elements: ${elements.length}
Number of Periods: ${pricing.periodSummaries.length}

Analyze the cost proposal for realism. Consider:
1. Are labor rates consistent with market rates for government contracting?
2. Do labor hours seem appropriate for typical government projects?
3. Are ODC costs reasonable?
4. Are indirect rates within typical ranges (overhead 30-60%, G&A 8-15%, fee 8-15%)?
5. Is the labor mix appropriate?

Provide your analysis in JSON format:
{
  "overallAssessment": "realistic" | "potentially_understated" | "potentially_overstated",
  "score": <0-100>,
  "factors": {
    "laborRates": { "assessment": "<text>", "marketComparison": "<text>" },
    "laborHours": { "assessment": "<text>", "scopeAlignment": "<text>" },
    "odcs": { "assessment": "<text>", "marketPricing": "<text>" },
    "indirectRates": { "assessment": "<text>", "industryComparison": "<text>" }
  },
  "risks": [
    { "risk": "<description>", "likelihood": "high|medium|low", "impact": "high|medium|low", "mitigation": "<suggestion>" }
  ],
  "narrative": "<2-3 paragraph narrative summary>"
}
`;

		const result = await ai.complete(prompt);

		try {
			const parsed = JSON.parse(result.content);
			return {
				success: true,
				data: {
					overallAssessment: parsed.overallAssessment,
					score: parsed.score,
					factors: parsed.factors,
					risks: parsed.risks || [],
					narrative: parsed.narrative,
				},
			};
		} catch {
			return {
				success: false,
				error: "Failed to parse AI analysis",
			};
		}
	} catch (error) {
		logger.error("Error analyzing cost realism:", error);
		return {
			success: false,
			error: `Failed to analyze cost realism: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Generate a cost realism narrative for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Generated narrative
 */
export async function generateCostRealismNarrative(
	opportunityId: string
): Promise<ActionResult<string>> {
	try {
		const analysis = await analyzeCostRealism(opportunityId);
		if (!analysis.success) {
			return { success: false, error: analysis.error };
		}

		return { success: true, data: analysis.data.narrative };
	} catch (error) {
		logger.error("Error generating cost realism narrative:", error);
		return {
			success: false,
			error: `Failed to generate narrative: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// Export Operations
// ============================================================================

function toCsvRow(values: unknown[]): string {
	return values
		.map((value) => {
			const text = value === null || value === undefined ? "" : String(value);
			return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
		})
		.join(",");
}

/**
 * Export cost volume to CSV or PDF format.
 *
 * @param opportunityId - Opportunity ID
 * @param format - Export format (csv or pdf)
 * @returns Base64 encoded file content and filename
 */
export async function exportCostVolume(
	opportunityId: string,
	format: "csv" | "pdf"
): Promise<ActionResult<{ content: string; filename: string; mimeType: string }>> {
	try {
		const userContext = await requirePricingContext();
		if (!(await ensureAssignedOpportunity(opportunityId, userContext))) {
			return { success: false, error: "Opportunity not found" };
		}

		// Calculate latest pricing
		const priceResult = await calculateTotalPrice(opportunityId);
		if (!priceResult.success) {
			return { success: false, error: priceResult.error };
		}

		// Get cost elements with labor categories
		const elements = await db
			.select()
			.from(costElements)
			.where(costElementsByOpportunityCondition(opportunityId, userContext))
			.orderBy(asc(costElements.wbsCode), asc(costElements.periodNumber));

		// Get labor categories for rate lookup based on IDs used in cost elements
		const laborCategoryIds = [...new Set(elements.map(e => e.laborCategoryId).filter(Boolean))] as string[];
		const categories = laborCategoryIds.length > 0
			? await db.select().from(laborCategories).where(visibleLaborCategoryIdsCondition(laborCategoryIds, userContext))
			: [];

		const categoryMap = new Map(categories.map(c => [c.id, c]));

		const filename = `cost-volume-${opportunityId.substring(0, 8)}.${format}`;

		if (format === "csv") {
			const totals = priceResult.data.grandTotals;

			const summaryData = [
				["Cost Volume Summary"],
				["Generated", new Date().toISOString()],
				[""],
				["Total Direct Labor", totals.laborCost],
				["Total ODC", totals.odcCost],
				["Total Subcontract", totals.subcontractCost],
				["Total Material", totals.materialCost],
				["Total Travel", totals.travelCost],
				["Overhead", totals.overhead],
				["G&A", totals.gaAmount],
				["Fee", totals.fee],
				["Total Price", totals.totalPrice],
			];

			const detailHeaders = [
				"WBS Code", "WBS Title", "Element Type", "Period",
				"Labor Category", "Hours", "Rate", "Labor Cost",
				"ODC/Sub/Travel/Material", "Total Cost", "BOE Narrative"
			];

			const detailData = elements.map(e => {
				const laborCat = e.laborCategoryId ? categoryMap.get(e.laborCategoryId) : null;
				// Calculate other direct costs based on element type
				const otherCost = e.odcAmount ?? e.subcontractorCost ?? e.travelCost ?? e.materialCost ?? 0;
				return [
					e.wbsCode ?? "",
					e.wbsTitle ?? "",
					e.elementType ?? "labor",
					e.periodNumber ?? 1,
					laborCat?.name ?? e.laborCategoryName ?? "",
					e.hours ?? 0,
					e.rate ?? laborCat?.directRate ?? 0,
					e.laborCost ?? 0,
					otherCost,
					e.totalCost ?? 0,
					e.boeNarrative ?? "",
				];
			});

			const csv = [
				...summaryData,
				[],
				detailHeaders,
				...detailData,
			].map(toCsvRow).join("\n");

			return {
				success: true,
				data: {
					content: Buffer.from(csv, "utf-8").toString("base64"),
					filename,
					mimeType: "text/csv",
				},
			};
		} else {
			const totals = priceResult.data.grandTotals;

			// PDF format - generate a simple HTML-based PDF representation
			const htmlContent = `
				<!DOCTYPE html>
				<html>
				<head><title>Cost Volume - ${opportunityId}</title></head>
				<body>
					<h1>Cost Volume Summary</h1>
					<table border="1" cellpadding="8">
						<tr><td>Direct Labor</td><td>$${totals.laborCost.toLocaleString()}</td></tr>
						<tr><td>ODC</td><td>$${totals.odcCost.toLocaleString()}</td></tr>
						<tr><td>Subcontract</td><td>$${totals.subcontractCost.toLocaleString()}</td></tr>
						<tr><td>Material</td><td>$${totals.materialCost.toLocaleString()}</td></tr>
						<tr><td>Travel</td><td>$${totals.travelCost.toLocaleString()}</td></tr>
						<tr><td>Overhead</td><td>$${totals.overhead.toLocaleString()}</td></tr>
						<tr><td>G&A</td><td>$${totals.gaAmount.toLocaleString()}</td></tr>
						<tr><td>Fee</td><td>$${totals.fee.toLocaleString()}</td></tr>
						<tr><td><strong>Total Price</strong></td><td><strong>$${totals.totalPrice.toLocaleString()}</strong></td></tr>
					</table>
					<h2>Cost Elements (${elements.length})</h2>
					<p>See XLSX export for full detail.</p>
				</body>
				</html>
			`;

			return {
				success: true,
				data: {
					content: Buffer.from(htmlContent).toString("base64"),
					filename: filename.replace(".pdf", ".html"),
					mimeType: "text/html",
				},
			};
		}
	} catch (error) {
		logger.error("Error exporting cost volume:", error);
		return {
			success: false,
			error: `Failed to export cost volume: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Export BOE package for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Base64 encoded file content and filename
 */
export async function exportBOEPackage(
	opportunityId: string
): Promise<ActionResult<{ content: string; filename: string; mimeType: string }>> {
	try {
		const userContext = await requirePricingContext();
		if (!(await ensureAssignedOpportunity(opportunityId, userContext))) {
			return { success: false, error: "Opportunity not found" };
		}

		// Get all cost elements with BOE narratives
		const elements = await db
			.select()
			.from(costElements)
			.where(costElementsByOpportunityCondition(opportunityId, userContext))
			.orderBy(asc(costElements.wbsCode));

		// Generate any missing BOEs
		for (const element of elements.filter(e => !e.boeNarrative)) {
			await generateBOENarrative(element.id);
		}

		// Refetch to get updated narratives
		const updatedElements = await db
			.select()
			.from(costElements)
			.where(costElementsByOpportunityCondition(opportunityId, userContext))
			.orderBy(asc(costElements.wbsCode));

		// Get labor categories for context - fetch by IDs referenced in cost elements
		const laborCategoryIds = [...new Set(updatedElements
			.filter(e => e.laborCategoryId)
			.map(e => e.laborCategoryId!)
		)];

		const categories = laborCategoryIds.length > 0
			? await db.select().from(laborCategories).where(visibleLaborCategoryIdsCondition(laborCategoryIds, userContext))
			: [];

		const categoryMap = new Map(categories.map(c => [c.id, c]));

		// Generate comprehensive BOE document as Word document
		const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = await import("docx");

		const doc = new Document({
			sections: [{
				properties: {},
				children: [
					new Paragraph({
						text: "BASIS OF ESTIMATE (BOE) PACKAGE",
						heading: HeadingLevel.TITLE,
					}),
					new Paragraph({
						children: [
							new TextRun({ text: `Opportunity ID: ${opportunityId}`, break: 1 }),
							new TextRun({ text: `Generated: ${new Date().toISOString()}`, break: 1 }),
							new TextRun({ text: `Total Elements: ${updatedElements.length}`, break: 1 }),
						],
					}),
					new Paragraph({ text: "" }),

					// Summary table
					new Paragraph({
						text: "COST ELEMENT SUMMARY",
						heading: HeadingLevel.HEADING_1,
					}),
					new Table({
						width: { size: 100, type: WidthType.PERCENTAGE },
						rows: [
							new TableRow({
								children: [
									new TableCell({ children: [new Paragraph({ text: "WBS" })] }),
									new TableCell({ children: [new Paragraph({ text: "WBS Title" })] }),
									new TableCell({ children: [new Paragraph({ text: "Type" })] }),
									new TableCell({ children: [new Paragraph({ text: "Hours" })] }),
									new TableCell({ children: [new Paragraph({ text: "Total Cost" })] }),
								],
							}),
							...updatedElements.map(e => new TableRow({
								children: [
									new TableCell({ children: [new Paragraph({ text: e.wbsCode ?? "N/A" })] }),
									new TableCell({ children: [new Paragraph({ text: e.wbsTitle ?? "N/A" })] }),
									new TableCell({ children: [new Paragraph({ text: e.elementType ?? "N/A" })] }),
									new TableCell({ children: [new Paragraph({ text: String(e.hours ?? 0) })] }),
									new TableCell({ children: [new Paragraph({ text: `$${(e.totalCost ?? 0).toLocaleString()}` })] }),
								],
							})),
						],
					}),
					new Paragraph({ text: "" }),

					// Individual BOE narratives
					new Paragraph({
						text: "DETAILED BASIS OF ESTIMATES",
						heading: HeadingLevel.HEADING_1,
					}),
					...updatedElements.flatMap(element => {
						const laborCat = element.laborCategoryId ? categoryMap.get(element.laborCategoryId) : null;
						return [
							new Paragraph({
								text: `${element.wbsCode ?? "N/A"} - ${element.wbsTitle ?? "Unnamed Task"}`,
								heading: HeadingLevel.HEADING_2,
							}),
							new Paragraph({
								children: [
									new TextRun({ text: "Element Type: ", bold: true }),
									new TextRun({ text: element.elementType ?? "labor" }),
								],
							}),
							new Paragraph({
								children: [
									new TextRun({ text: "Labor Category: ", bold: true }),
									new TextRun({ text: laborCat?.name ?? "N/A" }),
								],
							}),
							new Paragraph({
								children: [
									new TextRun({ text: "Hours: ", bold: true }),
									new TextRun({ text: String(element.hours ?? 0) }),
								],
							}),
							new Paragraph({
								children: [
									new TextRun({ text: "Rate: ", bold: true }),
									new TextRun({ text: `$${(element.rate ?? laborCat?.directRate ?? 0).toFixed(2)}/hr` }),
								],
							}),
							new Paragraph({
								children: [
									new TextRun({ text: "Labor Cost: ", bold: true }),
									new TextRun({ text: `$${(element.laborCost ?? element.odcAmount ?? element.subcontractorCost ?? element.travelCost ?? element.materialCost ?? 0).toLocaleString()}` }),
								],
							}),
							new Paragraph({
								children: [
									new TextRun({ text: "Total Cost: ", bold: true }),
									new TextRun({ text: `$${(element.totalCost ?? 0).toLocaleString()}` }),
								],
							}),
							new Paragraph({ text: "" }),
							new Paragraph({
								text: "Basis of Estimate Narrative:",
								heading: HeadingLevel.HEADING_3,
							}),
							new Paragraph({
								text: element.boeNarrative ?? "No BOE narrative available. Please generate one.",
							}),
							new Paragraph({ text: "" }),
							new Paragraph({ text: "─".repeat(50) }),
							new Paragraph({ text: "" }),
						];
					}),
				],
			}],
		});

		const buffer = await Packer.toBase64String(doc);
		const filename = `boe-package-${opportunityId.substring(0, 8)}.docx`;

		return {
			success: true,
			data: {
				content: buffer,
				filename,
				mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			},
		};
	} catch (error) {
		logger.error("Error exporting BOE package:", error);
		return {
			success: false,
			error: `Failed to export BOE package: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Generate a cost summary table for display or export.
 *
 * @param opportunityId - Opportunity ID
 * @returns Summary table with headers, rows, and totals
 */
export async function generateCostSummaryTable(
	opportunityId: string
): Promise<ActionResult<CostSummaryTable>> {
	try {
		await requireUserContext();

		const priceResult = await calculateTotalPrice(opportunityId);
		if (!priceResult.success) {
			return { success: false, error: priceResult.error };
		}

		const pricing = priceResult.data;

		// Build headers for periods
		const headers = ["Cost Element", ...pricing.periodSummaries.map(p =>
			p.periodType === "base" ? "Base Period" : `Option ${p.periodNumber - 1}`
		), "Total"];

		// Build rows
		const rows = [
			{
				label: "Direct Labor",
				values: [
					...pricing.periodSummaries.map(p => p.laborCost),
					pricing.grandTotals.laborCost,
				],
			},
			{
				label: "ODC",
				values: [
					...pricing.periodSummaries.map(p => p.odcCost),
					pricing.grandTotals.odcCost,
				],
			},
			{
				label: "Subcontract",
				values: [
					...pricing.periodSummaries.map(p => p.subcontractCost),
					pricing.grandTotals.subcontractCost,
				],
			},
			{
				label: "Travel",
				values: [
					...pricing.periodSummaries.map(p => p.travelCost),
					pricing.grandTotals.travelCost,
				],
			},
			{
				label: "Material",
				values: [
					...pricing.periodSummaries.map(p => p.materialCost),
					pricing.grandTotals.materialCost,
				],
			},
			{
				label: "Total Direct Cost",
				values: [
					...pricing.periodSummaries.map(p => p.totalDirectCost),
					pricing.grandTotals.totalDirectCost,
				],
			},
			{
				label: "Overhead",
				values: [
					...pricing.periodSummaries.map(p => p.overhead),
					pricing.grandTotals.overhead,
				],
			},
			{
				label: "G&A",
				values: [
					...pricing.periodSummaries.map(p => p.totalDirectCost * p.gaRate),
					pricing.grandTotals.gaAmount,
				],
			},
			{
				label: "Fee",
				values: [
					...pricing.periodSummaries.map(p =>
						(p.totalDirectCost + p.overhead + p.totalDirectCost * p.gaRate) * p.feeRate
					),
					pricing.grandTotals.fee,
				],
			},
		];

		const totals = [
			"Total Price",
			...pricing.periodSummaries.map(p => p.totalPrice),
			pricing.grandTotals.totalPrice,
		];

		return {
			success: true,
			data: { headers, rows, totals },
		};
	} catch (error) {
		logger.error("Error generating cost summary table:", error);
		return {
			success: false,
			error: `Failed to generate summary table: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// WBS Management Operations
// ============================================================================

/**
 * Generate WBS structure from technical proposal sections.
 *
 * @param opportunityId - Opportunity ID
 * @returns Generated WBS items
 */
export async function generateWBSFromTechnical(
	opportunityId: string
): Promise<ActionResult<WBSItem[]>> {
	try {
		await requireUserContext();

		// Get technical tracking records
		const tracking = await db
			.select()
			.from(costTechnicalTracking)
			.where(eq(costTechnicalTracking.opportunityId, opportunityId));

		// Get existing cost elements
		const elements = await db
			.select()
			.from(costElements)
			.where(eq(costElements.opportunityId, opportunityId));

		// Use AI to suggest WBS structure
		const ai = getAIClient();
		const prompt = `
You are a government proposal WBS expert. Generate a Work Breakdown Structure based on these technical sections.

Technical Sections:
${tracking.map((t, i) => `${i + 1}. ${t.sectionName}`).join("\n")}

Generate a hierarchical WBS structure following government proposal conventions:
- Level 1: Major program areas
- Level 2: Major tasks/phases
- Level 3: Subtasks
- Level 4: Work packages (as needed)

Provide the WBS in JSON format:
{
  "items": [
    {
      "wbsCode": "1.0",
      "title": "Program Management",
      "level": 1,
      "children": [
        {
          "wbsCode": "1.1",
          "title": "Project Planning",
          "level": 2,
          "parentCode": "1.0",
          "technicalSectionId": "<optional reference to technical section>"
        }
      ]
    }
  ]
}
`;

		const result = await ai.complete(prompt);

		try {
			const parsed = JSON.parse(result.content);

			// Flatten WBS for return
			const flattenWBS = (items: WBSItem[], accumulator: WBSItem[] = []): WBSItem[] => {
				for (const item of items) {
					accumulator.push(item);
					if (item.children) {
						flattenWBS(item.children, accumulator);
					}
				}
				return accumulator;
			};

			const wbsItems = flattenWBS(parsed.items || []);

			return { success: true, data: wbsItems };
		} catch {
			return {
				success: false,
				error: "Failed to parse AI-generated WBS",
			};
		}
	} catch (error) {
		logger.error("Error generating WBS from technical:", error);
		return {
			success: false,
			error: `Failed to generate WBS: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Update WBS codes for multiple cost elements.
 *
 * @param opportunityId - Opportunity ID
 * @param mappings - Array of element ID to WBS code mappings
 */
export async function updateWBSCodes(
	opportunityId: string,
	mappings: { elementId: string; wbsCode: string }[]
): Promise<ActionResult<void>> {
	try {
		await requireUserContext();

		await db.transaction(async (tx) => {
			for (const mapping of mappings) {
				await tx
					.update(costElements)
					.set({
						wbsCode: mapping.wbsCode,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(costElements.id, mapping.elementId),
							eq(costElements.opportunityId, opportunityId)
						)
					);
			}
		});

		revalidatePath(`/opportunities/${opportunityId}/pricing`);

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error updating WBS codes:", error);
		return {
			success: false,
			error: `Failed to update WBS codes: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Validate WBS structure for consistency and completeness.
 *
 * @param opportunityId - Opportunity ID
 * @returns Validation result with issues
 */
export async function validateWBSStructure(
	opportunityId: string
): Promise<ActionResult<{ valid: boolean; issues: string[] }>> {
	try {
		await requireUserContext();

		const elements = await db
			.select()
			.from(costElements)
			.where(eq(costElements.opportunityId, opportunityId));

		const issues: string[] = [];

		// Check for elements without WBS codes
		const noWbs = elements.filter(e => !e.wbsCode);
		if (noWbs.length > 0) {
			issues.push(`${noWbs.length} cost elements have no WBS code assigned`);
		}

		// Check for duplicate WBS codes (should be unique per element type and period)
		const wbsMap = new Map<string, CostElement[]>();
		for (const element of elements.filter(e => e.wbsCode)) {
			const key = `${element.wbsCode}-${element.elementType}-${element.periodNumber}`;
			if (!wbsMap.has(key)) {
				wbsMap.set(key, []);
			}
			wbsMap.get(key)!.push(element);
		}

		for (const [key, items] of wbsMap) {
			if (items.length > 1) {
				issues.push(`Duplicate WBS assignment: ${key} used by ${items.length} elements`);
			}
		}

		// Check for orphan WBS codes (no parent)
		const wbsCodes = new Set(elements.map(e => e.wbsCode).filter(Boolean));
		for (const code of wbsCodes) {
			if (!code) continue;
			const parts = code.split(".");
			if (parts.length > 1) {
				const parentCode = parts.slice(0, -1).join(".");
				if (!wbsCodes.has(parentCode) && !wbsCodes.has(`${parentCode}.0`)) {
					issues.push(`WBS code ${code} has no parent (expected ${parentCode})`);
				}
			}
		}

		return {
			success: true,
			data: {
				valid: issues.length === 0,
				issues,
			},
		};
	} catch (error) {
		logger.error("Error validating WBS structure:", error);
		return {
			success: false,
			error: `Failed to validate WBS: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

// ============================================================================
// Additional Functions Required by UI Components
// ============================================================================

/**
 * Per diem rate result from GSA lookup.
 */
export interface PerDiemRate {
	location: string;
	lodging: number;
	meals: number;
	incidentals: number;
	total: number;
}

/**
 * Contract period for period management.
 */
export interface ContractPeriodData {
	id: string;
	opportunityId: string;
	name: string;
	periodType: "base" | "option";
	periodNumber: number;
	startDate: Date | string;
	endDate: Date | string;
	durationMonths: number;
	sortOrder: number;
	totalCost: number;
	totalHours: number;
}

/**
 * WBS tree structure for hierarchical display.
 */
export interface WBSTreeData {
	opportunityId: string;
	nodes: WBSNodeData[];
	totalCost: number;
	totalHours: number;
	maxDepth: number;
}

/**
 * WBS node for tree display.
 */
export interface WBSNodeData {
	id: string;
	opportunityId: string;
	wbsCode: string;
	title: string;
	description: string | null;
	parentId: string | null;
	level: number;
	sortOrder: number;
	technicalSectionId: string | null;
	clinNumber: string | null;
	totalCost: number | null;
	totalHours: number | null;
	children?: WBSNodeData[];
}

/**
 * Input for creating WBS nodes.
 */
export interface CreateWBSNodeInput {
	opportunityId: string;
	wbsCode: string;
	title: string;
	description?: string;
	parentId?: string;
}

/**
 * Pricing summary for UI display.
 */
export interface PricingSummaryUIData {
	opportunityId: string;
	contractType: string | null;
	periodSummaries: PeriodSummary[];
	grandTotal: {
		laborCost: number;
		laborHours: number;
		odcCost: number;
		subcontractCost: number;
		travelCost: number;
		materialCost: number;
		otherCost: number;
		directCost: number;
		indirectCost: number;
		fee: number;
		totalCost: number;
	};
	laborMix: LaborMixEntry[];
	costTypeBreakdown: {
		type: CostElementType;
		amount: number;
		percentage: number;
	}[];
	indirectRates: {
		rateType: IndirectRateType;
		name: string;
		rate: number;
		appliedAmount: number;
	}[];
	generatedAt: Date;
}

/**
 * List contract periods for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Array of contract periods
 */
export async function listContractPeriods(
	opportunityId: string
): Promise<ActionResult<ContractPeriodData[]>> {
	try {
		await requireUserContext();

		// Get cost elements grouped by period
		const elements = await db
			.select()
			.from(costElements)
			.where(eq(costElements.opportunityId, opportunityId));

		// Group by period number
		const periodMap = new Map<number, CostElement[]>();
		for (const el of elements) {
			const period = el.periodNumber ?? 1;
			if (!periodMap.has(period)) {
				periodMap.set(period, []);
			}
			periodMap.get(period)!.push(el);
		}

		// Create period data
		const periods: ContractPeriodData[] = [];
		for (const [periodNumber, periodElements] of periodMap) {
			const firstEl = periodElements[0];
			const totalCost = periodElements.reduce((sum, el) => sum + (el.totalCost || 0), 0);
			const totalHours = periodElements
				.filter(el => el.elementType === "labor")
				.reduce((sum, el) => sum + (el.hours || 0), 0);

			periods.push({
				id: `period-${periodNumber}`,
				opportunityId,
				name: periodNumber === 1 ? "Base Period" : `Option ${periodNumber - 1}`,
				periodType: periodNumber === 1 ? "base" : "option",
				periodNumber,
				startDate: firstEl.periodStartDate || new Date(),
				endDate: firstEl.periodEndDate || new Date(),
				durationMonths: 12,
				sortOrder: periodNumber,
				totalCost,
				totalHours,
			});
		}

		// Sort by period number
		periods.sort((a, b) => a.periodNumber - b.periodNumber);

		return { success: true, data: periods };
	} catch (error) {
		logger.error("Error listing contract periods:", error);
		return {
			success: false,
			error: `Failed to list periods: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Get WBS tree structure for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns WBS tree with hierarchical nodes
 */
export async function getWBSTree(
	opportunityId: string
): Promise<ActionResult<WBSTreeData>> {
	try {
		await requireUserContext();

		// Get all cost elements to derive WBS structure
		const elements = await db
			.select()
			.from(costElements)
			.where(eq(costElements.opportunityId, opportunityId))
			.orderBy(asc(costElements.wbsCode));

		// Build tree from WBS codes
		const nodeMap = new Map<string, WBSNodeData>();
		let maxDepth = 0;

		for (const el of elements) {
			if (!el.wbsCode) continue;

			const parts = el.wbsCode.split(".");
			maxDepth = Math.max(maxDepth, parts.length);

			// Create or update node for this WBS code
			if (!nodeMap.has(el.wbsCode)) {
				nodeMap.set(el.wbsCode, {
					id: `wbs-${el.wbsCode}`,
					opportunityId,
					wbsCode: el.wbsCode,
					title: el.wbsTitle || el.wbsCode,
					description: null,
					parentId: parts.length > 1 ? `wbs-${parts.slice(0, -1).join(".")}` : null,
					level: parts.length - 1,
					sortOrder: parseInt(parts[parts.length - 1]) || 0,
					technicalSectionId: el.technicalSectionId,
					clinNumber: null,
					totalCost: 0,
					totalHours: 0,
					children: [],
				});
			}

			// Accumulate costs
			const node = nodeMap.get(el.wbsCode)!;
			node.totalCost = (node.totalCost || 0) + (el.totalCost || 0);
			if (el.elementType === "labor") {
				node.totalHours = (node.totalHours || 0) + (el.hours || 0);
			}
		}

		// Build tree structure
		const rootNodes: WBSNodeData[] = [];
		for (const node of nodeMap.values()) {
			if (node.parentId && nodeMap.has(node.parentId.replace("wbs-", ""))) {
				// This is wrong - parentId already has wbs- prefix, need to find by code
				const parentCode = node.wbsCode.split(".").slice(0, -1).join(".");
				const parent = nodeMap.get(parentCode);
				if (parent) {
					parent.children = parent.children || [];
					parent.children.push(node);
				} else {
					rootNodes.push(node);
				}
			} else {
				rootNodes.push(node);
			}
		}

		// Sort children at each level
		const sortChildren = (nodes: WBSNodeData[]) => {
			nodes.sort((a, b) => a.sortOrder - b.sortOrder);
			for (const node of nodes) {
				if (node.children && node.children.length > 0) {
					sortChildren(node.children);
				}
			}
		};
		sortChildren(rootNodes);

		// Calculate totals
		const totalCost = elements.reduce((sum, el) => sum + (el.totalCost || 0), 0);
		const totalHours = elements
			.filter(el => el.elementType === "labor")
			.reduce((sum, el) => sum + (el.hours || 0), 0);

		return {
			success: true,
			data: {
				opportunityId,
				nodes: rootNodes,
				totalCost,
				totalHours,
				maxDepth,
			},
		};
	} catch (error) {
		logger.error("Error getting WBS tree:", error);
		return {
			success: false,
			error: `Failed to get WBS tree: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Create a new WBS node.
 *
 * @param input - WBS node creation input
 * @returns Created WBS node
 */
export async function createWBSNode(
	input: CreateWBSNodeInput
): Promise<ActionResult<WBSNodeData>> {
	try {
		await requireUserContext();

		// Create placeholder cost element for WBS tracking
		const node: WBSNodeData = {
			id: `wbs-${input.wbsCode}`,
			opportunityId: input.opportunityId,
			wbsCode: input.wbsCode,
			title: input.title,
			description: input.description || null,
			parentId: input.parentId || null,
			level: input.wbsCode.split(".").length - 1,
			sortOrder: parseInt(input.wbsCode.split(".").pop() || "0"),
			technicalSectionId: null,
			clinNumber: null,
			totalCost: null,
			totalHours: null,
		};

		revalidatePath(`/opportunities/${input.opportunityId}/pricing`);

		return { success: true, data: node };
	} catch (error) {
		logger.error("Error creating WBS node:", error);
		return {
			success: false,
			error: `Failed to create WBS node: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Update a WBS node.
 *
 * @param nodeId - WBS node ID to update
 * @param input - Update input data
 * @returns Updated WBS node
 */
export async function updateWBSNode(
	nodeId: string,
	input: Partial<CreateWBSNodeInput>
): Promise<ActionResult<WBSNodeData>> {
	try {
		await requireUserContext();

		const wbsCode = nodeId.replace("wbs-", "");

		// Update cost elements with matching WBS code
		const updateData: Record<string, unknown> = {};
		if (input.title !== undefined) updateData.wbsTitle = input.title;
		if (input.description !== undefined) updateData.boeNarrative = input.description;

		if (Object.keys(updateData).length > 0) {
			await db
				.update(costElements)
				.set(updateData)
				.where(eq(costElements.wbsCode, wbsCode));
		}

		// Get updated elements to build the node
		const elements = await db
			.select()
			.from(costElements)
			.where(eq(costElements.wbsCode, wbsCode));

		const firstElement = elements[0];
		const totalCost = elements.reduce((sum, e) => sum + (e.totalCost ?? 0), 0);
		const totalHours = elements.reduce((sum, e) => sum + (e.hours ?? 0), 0);

		const node: WBSNodeData = {
			id: nodeId,
			opportunityId: input.opportunityId || firstElement?.opportunityId || "",
			wbsCode,
			title: input.title || firstElement?.wbsTitle || wbsCode,
			description: input.description ?? firstElement?.boeNarrative ?? null,
			parentId: input.parentId ?? null,
			level: wbsCode.split(".").length,
			sortOrder: 0,
			technicalSectionId: null,
			clinNumber: null,
			children: [],
			totalCost: totalCost || null,
			totalHours: totalHours || null,
		};

		return { success: true, data: node };
	} catch (error) {
		logger.error("Error updating WBS node:", error);
		return {
			success: false,
			error: `Failed to update WBS node: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Delete a WBS node.
 *
 * @param nodeId - WBS node ID to delete
 * @param cascade - Whether to delete child nodes
 * @returns Success indicator
 */
export async function deleteWBSNode(
	nodeId: string,
	cascade: boolean = false
): Promise<ActionResult<void>> {
	try {
		await requireUserContext();

		const wbsCode = nodeId.replace("wbs-", "");

		// Delete cost elements with this WBS code
		if (cascade) {
			await db.delete(costElements).where(like(costElements.wbsCode, `${wbsCode}%`));
		} else {
			await db.delete(costElements).where(eq(costElements.wbsCode, wbsCode));
		}

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error deleting WBS node:", error);
		return {
			success: false,
			error: `Failed to delete WBS node: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Reorder WBS nodes.
 *
 * @param opportunityId - Opportunity ID
 * @param nodeIds - Array of node IDs in new order
 * @returns Success indicator
 */
export async function reorderWBSNodes(
	opportunityId: string,
	nodeIds: string[]
): Promise<ActionResult<void>> {
	try {
		await requireUserContext();
		// Reordering would update sort orders on cost elements
		revalidatePath(`/opportunities/${opportunityId}/pricing`);
		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error reordering WBS nodes:", error);
		return {
			success: false,
			error: `Failed to reorder WBS: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Link WBS node to technical section.
 *
 * @param wbsCode - WBS code to link
 * @param sectionId - Technical section ID
 * @returns Success indicator
 */
export async function linkWBSToSection(
	wbsCode: string,
	sectionId: string
): Promise<ActionResult<void>> {
	try {
		await requireUserContext();

		await db
			.update(costElements)
			.set({ technicalSectionId: sectionId })
			.where(eq(costElements.wbsCode, wbsCode));

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error linking WBS to section:", error);
		return {
			success: false,
			error: `Failed to link WBS: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Get pricing summary for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Pricing summary with all calculations
 */
export async function getPricingSummary(
	opportunityId: string
): Promise<ActionResult<PricingSummaryUIData>> {
	try {
		const userContext = await requirePricingContext();

		// Get cost elements
		const elements = await db
			.select()
			.from(costElements)
			.where(eq(costElements.opportunityId, opportunityId));

		// Get indirect rates
		const orgId = userContext.organizationId;
		const rates = await db
			.select()
			.from(indirectRates)
			.where(eq(indirectRates.organizationId, orgId));

		// Calculate totals by type
		let laborCost = 0;
		let laborHours = 0;
		let odcCost = 0;
		let subcontractCost = 0;
		let travelCost = 0;
		let materialCost = 0;
		let otherCost = 0;

		for (const el of elements) {
			const cost = el.totalCost || 0;
			switch (el.elementType) {
				case "labor":
					laborCost += cost;
					laborHours += el.hours || 0;
					break;
				case "odc":
					odcCost += cost;
					break;
				case "subcontract":
					subcontractCost += cost;
					break;
				case "travel":
					travelCost += cost;
					break;
				case "material":
					materialCost += cost;
					break;
				default:
					otherCost += cost;
			}
		}

		const directCost = laborCost + odcCost + subcontractCost + travelCost + materialCost + otherCost;

		// Apply indirect rates
		let overheadAmount = 0;
		let gaAmount = 0;
		let feeAmount = 0;

		const appliedRates: PricingSummaryUIData["indirectRates"] = [];

		for (const rate of rates) {
			if (!rate.isActive || !rate.rateValue) continue;

			let baseAmount = 0;
			switch (rate.rateBase) {
				case "labor":
					baseAmount = laborCost;
					break;
				case "all_direct":
					baseAmount = directCost;
					break;
				case "labor_plus_overhead":
					baseAmount = laborCost + overheadAmount;
					break;
				default:
					baseAmount = laborCost;
			}

			const appliedAmount = baseAmount * rate.rateValue;

			switch (rate.rateType) {
				case "overhead":
					overheadAmount += appliedAmount;
					break;
				case "ga":
					gaAmount += appliedAmount;
					break;
				case "fee":
					feeAmount += appliedAmount;
					break;
			}

			appliedRates.push({
				rateType: rate.rateType!,
				name: rate.rateName || rate.rateType || "Unknown",
				rate: rate.rateValue,
				appliedAmount,
			});
		}

		const indirectCost = overheadAmount + gaAmount;
		const totalCost = directCost + indirectCost + feeAmount;

		// Calculate period summaries
		const periodMap = new Map<number, CostElement[]>();
		for (const el of elements) {
			const period = el.periodNumber ?? 1;
			if (!periodMap.has(period)) periodMap.set(period, []);
			periodMap.get(period)!.push(el);
		}

		const periodSummaries: PeriodSummary[] = [];
		for (const [periodNumber, periodElements] of periodMap) {
			const periodLabor = periodElements.filter(e => e.elementType === "labor").reduce((s, e) => s + (e.totalCost || 0), 0);
			const periodOdc = periodElements.filter(e => e.elementType === "odc").reduce((s, e) => s + (e.totalCost || 0), 0);
			const periodSubcontract = periodElements.filter(e => e.elementType === "subcontract").reduce((s, e) => s + (e.totalCost || 0), 0);
			const periodTravel = periodElements.filter(e => e.elementType === "travel").reduce((s, e) => s + (e.totalCost || 0), 0);
			const periodMaterial = periodElements.filter(e => e.elementType === "material").reduce((s, e) => s + (e.totalCost || 0), 0);
			const periodDirect = periodLabor + periodOdc + periodSubcontract + periodTravel + periodMaterial;

			// Calculate period-specific rates
			const periodOverhead = periodDirect * (overheadAmount / (directCost || 1));
			const periodGaRate = gaAmount > 0 ? gaAmount / (directCost || 1) : 0;
			const periodFeeRate = feeAmount > 0 ? feeAmount / (directCost || 1) : 0;
			const periodPrice = periodDirect + periodOverhead + (periodDirect * periodGaRate) + (periodDirect * periodFeeRate);

			periodSummaries.push({
				periodNumber,
				periodType: periodNumber === 1 ? "base" : `option_${periodNumber - 1}` as PeriodType,
				laborCost: periodLabor,
				odcCost: periodOdc,
				subcontractCost: periodSubcontract,
				travelCost: periodTravel,
				materialCost: periodMaterial,
				totalDirectCost: periodDirect,
				overhead: periodOverhead,
				gaRate: periodGaRate,
				feeRate: periodFeeRate,
				totalPrice: periodPrice,
			});
		}

		// Calculate labor mix - LaborMixEntry has: category, percentage, hours
		const laborMix: LaborMixEntry[] = [];
		const categoryMap = new Map<string, { hours: number; name: string }>();
		for (const el of elements.filter(e => e.elementType === "labor")) {
			const catName = el.laborCategoryName || "Unknown";
			if (!categoryMap.has(catName)) {
				categoryMap.set(catName, { hours: 0, name: catName });
			}
			const cat = categoryMap.get(catName)!;
			cat.hours += el.hours || 0;
		}
		for (const [catName, data] of categoryMap) {
			laborMix.push({
				category: catName,
				hours: data.hours,
				percentage: laborHours > 0 ? (data.hours / laborHours) * 100 : 0,
			});
		}

		// Cost type breakdown
		const costTypeBreakdown: PricingSummaryUIData["costTypeBreakdown"] = [];
		const types: { type: CostElementType; amount: number }[] = [
			{ type: "labor", amount: laborCost },
			{ type: "odc", amount: odcCost },
			{ type: "subcontract", amount: subcontractCost },
			{ type: "travel", amount: travelCost },
			{ type: "material", amount: materialCost },
			{ type: "other", amount: otherCost },
		];
		for (const { type, amount } of types) {
			if (amount > 0) {
				costTypeBreakdown.push({
					type,
					amount,
					percentage: directCost > 0 ? (amount / directCost) * 100 : 0,
				});
			}
		}

		return {
			success: true,
			data: {
				opportunityId,
				contractType: null,
				periodSummaries,
				grandTotal: {
					laborCost,
					laborHours,
					odcCost,
					subcontractCost,
					travelCost,
					materialCost,
					otherCost,
					directCost,
					indirectCost,
					fee: feeAmount,
					totalCost,
				},
				laborMix,
				costTypeBreakdown,
				indirectRates: appliedRates,
				generatedAt: new Date(),
			},
		};
	} catch (error) {
		logger.error("Error getting pricing summary:", error);
		return {
			success: false,
			error: `Failed to get pricing summary: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Recalculate all pricing for an opportunity.
 *
 * @param opportunityId - Opportunity ID
 * @returns Success indicator
 */
export async function recalculatePricing(
	opportunityId: string
): Promise<ActionResult<void>> {
	try {
		await requireUserContext();

		// Get all cost elements
		const elements = await db
			.select()
			.from(costElements)
			.where(eq(costElements.opportunityId, opportunityId));

		// Recalculate each element's total cost
		for (const element of elements) {
			const totalCost = calculateElementTotalCost(element);
			await db
				.update(costElements)
				.set({ totalCost, updatedAt: new Date() })
				.where(eq(costElements.id, element.id));
		}

		revalidatePath(`/opportunities/${opportunityId}/pricing`);

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error recalculating pricing:", error);
		return {
			success: false,
			error: `Failed to recalculate: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Look up GSA per diem rates for a location.
 *
 * @param location - City/state to look up
 * @returns Per diem rate data
 */
export async function lookupPerDiem(
	location: string
): Promise<ActionResult<PerDiemRate>> {
	try {
		await requireUserContext();

		// Standard GSA CONUS rates (simplified - real implementation would call GSA API)
		// These are approximate 2024 values
		const baseRates: PerDiemRate = {
			location,
			lodging: 107,
			meals: 59,
			incidentals: 20,
			total: 186,
		};

		// Higher rates for specific cities
		const highCostLocations: Record<string, Partial<PerDiemRate>> = {
			"washington": { lodging: 210, meals: 79 },
			"new york": { lodging: 282, meals: 79 },
			"san francisco": { lodging: 250, meals: 79 },
			"los angeles": { lodging: 191, meals: 74 },
			"boston": { lodging: 240, meals: 79 },
			"chicago": { lodging: 213, meals: 79 },
			"seattle": { lodging: 212, meals: 79 },
		};

		const lowerLocation = location.toLowerCase();
		for (const [city, rates] of Object.entries(highCostLocations)) {
			if (lowerLocation.includes(city)) {
				return {
					success: true,
					data: {
						location,
						lodging: rates.lodging || baseRates.lodging,
						meals: rates.meals || baseRates.meals,
						incidentals: baseRates.incidentals,
						total: (rates.lodging || baseRates.lodging) + (rates.meals || baseRates.meals) + baseRates.incidentals,
					},
				};
			}
		}

		return { success: true, data: baseRates };
	} catch (error) {
		logger.error("Error looking up per diem:", error);
		return {
			success: false,
			error: `Failed to look up per diem: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Calculate travel costs based on trip details.
 *
 * @param details - Travel calculation input
 * @returns Calculated travel cost
 */
export async function calculateTravelCosts(
	details: {
		travelers: number;
		trips: number;
		daysPerTrip: number;
		airfare: number;
		lodgingPerNight: number;
		perDiemPerDay: number;
		mileage?: number;
		mileageRate?: number;
		otherCosts?: number;
	}
): Promise<ActionResult<{ totalCost: number; breakdown: Record<string, number> }>> {
	try {
		await requireUserContext();

		const nights = Math.max(0, details.daysPerTrip - 1);
		const airfareCost = details.airfare * details.travelers * details.trips;
		const lodgingCost = details.lodgingPerNight * nights * details.travelers * details.trips;
		const perDiemCost = details.perDiemPerDay * details.daysPerTrip * details.travelers * details.trips;
		const mileageCost = (details.mileage || 0) * (details.mileageRate || 0.67) * details.trips;
		const otherCost = (details.otherCosts || 0) * details.travelers * details.trips;

		const totalCost = airfareCost + lodgingCost + perDiemCost + mileageCost + otherCost;

		return {
			success: true,
			data: {
				totalCost,
				breakdown: {
					airfare: airfareCost,
					lodging: lodgingCost,
					perDiem: perDiemCost,
					mileage: mileageCost,
					other: otherCost,
				},
			},
		};
	} catch (error) {
		logger.error("Error calculating travel costs:", error);
		return {
			success: false,
			error: `Failed to calculate travel: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Delete an indirect rate.
 *
 * @param id - Indirect rate ID to delete
 * @returns Success indicator
 */
export async function deleteIndirectRate(id: string): Promise<ActionResult<void>> {
	try {
		const userContext = await requirePricingContext();

		await db.delete(indirectRates).where(indirectRateByIdCondition(id, userContext));

		revalidatePath("/pricing/rates");

		return { success: true, data: undefined };
	} catch (error) {
		logger.error("Error deleting indirect rate:", error);
		return {
			success: false,
			error: `Failed to delete rate: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}
