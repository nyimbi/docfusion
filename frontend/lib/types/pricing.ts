/**
 * Pricing Types - DocFusion Integrated Cost Volume Generator
 *
 * Re-exports types from the database schema and server actions,
 * plus UI-specific types for the pricing components.
 */

// =============================================================================
// Imports from Database Schema (for use in this file's interfaces)
// =============================================================================

import type {
	CostElementType as CostElementTypeSchema,
	OdcType,
	PeriodType,
	CostElementStatus,
	IndirectRateType as IndirectRateTypeSchema,
	IndirectRateBase,
	RateApprovalSource,
	AlignmentIssueSeverity,
	MinEducation,
	PeriodSummary,
	LaborMixEntry as LaborMixEntrySchema,
	CostRiskFactor,
	AlignmentIssue,
	ImpliedStaffingEntry,
	LaborCategory,
	NewLaborCategory,
	CostElement,
	NewCostElement,
	PricingSummary as PricingSummaryRecord,
	NewPricingSummary,
	IndirectRate as IndirectRateSchema,
	NewIndirectRate,
	CostTechnicalTracking,
	NewCostTechnicalTracking,
	BoeTemplate,
	NewBoeTemplate,
} from "@/lib/db/schema-pricing";

// Re-export types for consumers
export type {
	CostElementTypeSchema as CostElementType,
	OdcType,
	PeriodType,
	CostElementStatus,
	IndirectRateTypeSchema as IndirectRateType,
	IndirectRateBase,
	RateApprovalSource,
	AlignmentIssueSeverity,
	MinEducation,
	PeriodSummary,
	LaborMixEntrySchema as LaborMixEntry,
	CostRiskFactor,
	AlignmentIssue,
	ImpliedStaffingEntry,
	LaborCategory,
	NewLaborCategory,
	CostElement,
	NewCostElement,
	PricingSummaryRecord,
	NewPricingSummary,
	IndirectRateSchema as IndirectRate,
	NewIndirectRate,
	CostTechnicalTracking,
	NewCostTechnicalTracking,
	BoeTemplate,
	NewBoeTemplate,
};

// Local aliases for use in this file
type CostElementType = CostElementTypeSchema;
type IndirectRateType = IndirectRateTypeSchema;
type IndirectRate = IndirectRateSchema;
type LaborMixEntry = LaborMixEntrySchema;

// =============================================================================
// Re-exports from Server Actions
// =============================================================================

export type {
	ActionResult,
	CreateLaborCategoryInput,
	UpdateLaborCategoryInput,
	LaborCategoryImport,
	CreateCostElementInput,
	UpdateCostElementInput,
	CostElementFilters,
	AlignmentReport,
	CostSuggestion,
	HoursEstimate,
	BOETemplateInput,
	PricingSummaryResult,
	IndirectRateInput,
	CostRealismAnalysis,
	CostSummaryTable,
	WBSItem,
} from "@/lib/actions/pricing";

// =============================================================================
// UI-Specific Types
// =============================================================================

/** Labor category level for display */
export type LaborLevel =
	| "junior"
	| "mid"
	| "senior"
	| "principal"
	| "executive";

/** Contract type for pricing model display */
export type ContractType =
	| "firm_fixed_price"
	| "time_and_materials"
	| "cost_plus_fixed_fee"
	| "cost_plus_award_fee"
	| "cost_plus_incentive_fee"
	| "labor_hour";

/** Alignment status for display */
export type AlignmentStatus = "aligned" | "partial" | "unlinked" | "mismatch";

/** Cost realism risk level for display */
export type CostRealismRisk = "low" | "medium" | "high" | "critical";

/** Complexity level for hours estimation */
export type ComplexityLevel = "simple" | "moderate" | "complex" | "highly_complex";

/** BOE template type */
export type BOETemplateType =
	| "labor"
	| "odc"
	| "travel"
	| "subcontract"
	| "material"
	| "general";

// =============================================================================
// Component-Specific Types
// =============================================================================

/**
 * WBS tree structure for hierarchical display.
 */
export interface WBSTree {
	opportunityId: string;
	nodes: WBSNode[];
	totalCost: number;
	totalHours: number;
	maxDepth: number;
}

/**
 * WBS node for tree display.
 */
export interface WBSNode {
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
	children?: WBSNode[];
}

/**
 * Contract period for period management.
 */
export interface ContractPeriod {
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
 * Travel details for travel calculator.
 */
export interface TravelDetails {
	tripPurpose: string;
	origin: string;
	destination: string;
	travelers: number;
	trips: number;
	daysPerTrip: number;
	airfare: number | null;
	perDiem: number | null;
	lodging: number | null;
	mileage: number | null;
	mileageRate: number | null;
	otherCosts: number | null;
	totalCost: number;
}

/**
 * Pricing scenario for comparison.
 */
export interface PricingScenario {
	id: string;
	opportunityId: string;
	name: string;
	description: string | null;
	isBaseline: boolean;
	totalCost: number;
	laborHours: number;
	indirectRateOverrides: {
		rateType: IndirectRateType;
		rate: number;
	}[];
	laborRateOverrides: {
		categoryId: string;
		hourlyRate: number;
	}[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Scenario comparison item.
 */
export interface ScenarioComparisonItem {
	label: string;
	category: "labor" | "odc" | "indirect" | "total";
	values: {
		scenarioId: string;
		scenarioName: string;
		amount: number;
	}[];
	deltaFromBaseline: {
		scenarioId: string;
		absoluteDelta: number;
		percentDelta: number;
	}[];
}

/**
 * Scenario comparison result.
 */
export interface ScenarioComparison {
	opportunityId: string;
	scenarios: PricingScenario[];
	baselineScenarioId: string | null;
	items: ScenarioComparisonItem[];
	summary: {
		lowestCostScenarioId: string;
		highestCostScenarioId: string;
		averageCost: number;
		costRange: number;
	};
}

/**
 * Labor category filters for UI.
 */
export interface LaborCategoryFilters {
	search?: string;
	levels?: LaborLevel[];
	isGsaRate?: boolean;
	status?: ("active" | "inactive" | "archived")[];
	minRate?: number;
	maxRate?: number;
}

/**
 * UI-specific alignment issue type (different from schema AlignmentIssue).
 */
export interface UIAlignmentIssue {
	id: string;
	type: "missing_cost" | "missing_technical" | "scope_mismatch" | "hours_mismatch";
	severity: "info" | "warning" | "error";
	message: string;
	recommendation?: string;
	technicalSectionName?: string;
	wbsCode?: string;
}

/**
 * Cost-technical alignment for display.
 */
export interface CostTechnicalAlignment {
	opportunityId: string;
	overallScore: number;
	technicalSections: {
		sectionId: string;
		sectionName: string;
		linkedWbsNodes: string[];
		alignmentStatus: AlignmentStatus;
		costAmount: number | null;
		issues: string[];
	}[];
	wbsNodes: {
		nodeId: string;
		wbsCode: string;
		title: string;
		linkedSections: string[];
		alignmentStatus: AlignmentStatus;
	}[];
	issues: UIAlignmentIssue[];
	recommendations: string[];
	analyzedAt: Date;
}

/**
 * BOE narrative for display.
 */
export interface BOENarrative {
	id: string;
	costElementId: string | null;
	opportunityId: string;
	templateId: string | null;
	content: string;
	isGenerated: boolean;
	generatedAt: Date | null;
	lastEditedAt: Date;
	lastEditedBy: string | null;
}

/**
 * Extended hours estimate with category details.
 */
export interface LaborHoursEstimate {
	laborCategoryId: string;
	laborCategoryName: string;
	level: LaborLevel | null;
	estimatedHours: number;
	confidenceLevel: number;
	reasoning: string;
}

/**
 * Extended hours estimation result.
 */
export interface HoursEstimateResult {
	sectionId: string | null;
	sectionName: string | null;
	complexity: ComplexityLevel;
	totalHours: number;
	byCategory: LaborHoursEstimate[];
	assumptions: string[];
	confidenceLevel: number;
	estimatedAt: Date;
}

/**
 * Indirect rate history entry.
 */
export interface IndirectRateHistory {
	rate: number;
	effectiveDate: Date;
	expirationDate: Date | null;
	dcaaApproved: boolean;
	changedAt: Date;
	changedBy: string | null;
}

/**
 * Extended indirect rate for UI.
 */
export interface IndirectRateUI extends Omit<IndirectRate, 'rateValue'> {
	rate: number;
	appliesTo: CostElementType[];
	history: IndirectRateHistory[];
}

/**
 * Period cost summary for display.
 */
export interface PeriodCostSummary {
	periodId: string;
	periodName: string;
	periodType: "base" | "option";
	laborCost: number;
	laborHours: number;
	odcCost: number;
	subcontractCost: number;
	travelCost: number;
	materialCost: number;
	otherCost: number;
	directCost: number;
	overheadCost: number;
	fringeCost: number;
	gaCost: number;
	indirectCost: number;
	subtotal: number;
	fee: number;
	totalCost: number;
}

/**
 * Full pricing summary for display.
 */
export interface PricingSummary {
	opportunityId: string;
	contractType: ContractType | null;
	periodSummaries: PeriodCostSummary[];
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
 * Cost realism factor for display.
 */
export interface CostRealismFactor {
	name: string;
	category: "labor" | "rates" | "assumptions" | "completeness" | "market";
	score: number;
	maxScore: number;
	findings: string[];
	risks: string[];
}

/**
 * Cost realism risk item for display.
 */
export interface CostRealismRiskItem {
	id: string;
	category: string;
	description: string;
	impact: "low" | "medium" | "high";
	likelihood: "low" | "medium" | "high";
	riskLevel: CostRealismRisk;
	mitigation: string | null;
}

/**
 * Extended cost realism analysis for UI.
 */
export interface CostRealismAnalysisUI {
	opportunityId: string;
	overallAssessment: CostRealismRisk;
	overallScore: number;
	factors: CostRealismFactor[];
	risks: CostRealismRiskItem[];
	narrative: string;
	recommendations: string[];
	analyzedAt: Date;
}

// Note: IndirectRateType already exported above from schema
