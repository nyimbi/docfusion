/**
 * Integrated Cost Volume Generator Database Schema - DocFusion
 *
 * Implements comprehensive cost and pricing management for government proposals,
 * supporting labor rate cards, cost elements, pricing summaries, indirect rates,
 * cost-technical alignment tracking, and Basis of Estimate (BOE) templates.
 *
 * Key Features:
 * - Labor category rate cards with GSA Schedule support and escalation tracking
 * - Detailed cost elements by WBS with full cost breakdown (labor, ODC, subs, travel, materials)
 * - Pricing summaries with roll-up calculations and period-based analysis
 * - Indirect rate management (overhead, G&A, fee) with DCAA approval tracking
 * - Cost-technical alignment validation ensuring pricing matches technical approach
 * - Reusable BOE narrative templates for consistent proposal development
 *
 * Tables:
 * - laborCategories: Labor rate cards with escalation and GSA Schedule info
 * - costElements: Line items in cost volume with WBS linkage and BOE narratives
 * - pricingSummaries: Roll-up pricing by opportunity with period summaries
 * - indirectRates: Organization's indirect rate structure with approval tracking
 * - costTechnicalTracking: Alignment validation between cost and technical volumes
 * - boeTemplates: Reusable Basis of Estimate narrative templates
 *
 * Government Cost Proposal Context:
 * Federal contractors must submit detailed cost proposals demonstrating price
 * reasonableness. Cost volumes require traceability from technical requirements
 * through Work Breakdown Structure (WBS) to specific labor categories and rates.
 * The Defense Contract Audit Agency (DCAA) may audit indirect rates, requiring
 * documentation of rate approval status and basis of estimates for all costs.
 * This schema enables systematic cost volume development ensuring compliance
 * with FAR Part 15 (Contracting by Negotiation) requirements.
 */

import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// ============================================================================
// COST ELEMENT TYPE ENUMERATIONS
// ============================================================================

/**
 * Classification of cost element types in a government cost proposal.
 * - labor: Direct labor costs by category/skill level
 * - odc: Other Direct Costs (equipment, software, supplies, services)
 * - subcontract: Subcontractor costs for teaming arrangements
 * - travel: Travel and per diem expenses
 * - material: Direct materials and consumables
 * - other: Miscellaneous direct costs not fitting other categories
 */
export type CostElementType =
	| "labor"
	| "odc"
	| "subcontract"
	| "travel"
	| "material"
	| "other";

/**
 * Classification of Other Direct Cost (ODC) types.
 * - equipment: Hardware, machinery, specialized equipment
 * - software: COTS software, licenses, subscriptions
 * - supplies: Consumable supplies and materials
 * - services: Third-party services not under subcontract
 */
export type OdcType = "equipment" | "software" | "supplies" | "services";

/**
 * Classification of contract period types.
 * - base: Base period of performance
 * - option_1 through option_4: Option periods as specified in the solicitation
 */
export type PeriodType =
	| "base"
	| "option_1"
	| "option_2"
	| "option_3"
	| "option_4";

/**
 * Status of cost element approval workflow.
 * - draft: Cost element being developed
 * - pending_review: Awaiting review and approval
 * - approved: Approved by authorized reviewer
 */
export type CostElementStatus = "draft" | "pending_review" | "approved";

/**
 * Classification of indirect rate types per FAR/DCAA guidelines.
 * - overhead: Pool of indirect costs allocated to direct labor
 * - ga: General & Administrative costs allocated to total cost input
 * - fee: Profit/fee as percentage of total estimated cost
 * - fringe: Fringe benefits applied to direct labor
 * - escalation: Annual cost escalation factors
 */
export type IndirectRateType =
	| "overhead"
	| "ga"
	| "fee"
	| "fringe"
	| "escalation";

/**
 * Base to which indirect rates are applied.
 * - labor: Applied to direct labor costs only
 * - total_cost: Applied to total cost (less fee)
 * - labor_plus_overhead: Applied to labor with overhead already applied
 * - all_direct: Applied to all direct costs
 */
export type IndirectRateBase =
	| "labor"
	| "total_cost"
	| "labor_plus_overhead"
	| "all_direct";

/**
 * Source of indirect rate approval.
 * - dcaa: Defense Contract Audit Agency approved rates
 * - provisional: Provisional billing rates pending final audit
 * - forward_pricing: Forward pricing rate agreement (FPRA)
 * - budgetary: Budgetary rates for planning purposes only
 */
export type RateApprovalSource =
	| "dcaa"
	| "provisional"
	| "forward_pricing"
	| "budgetary";

/**
 * Severity level of cost-technical alignment issues.
 * - critical: Major misalignment requiring immediate resolution
 * - major: Significant issue that should be addressed before submission
 * - minor: Small discrepancy with limited impact
 * - info: Informational note, no action required
 */
export type AlignmentIssueSeverity = "critical" | "major" | "minor" | "info";

/**
 * Minimum education level required for labor categories.
 * - hs: High School diploma or GED
 * - aa: Associate's degree
 * - bs: Bachelor's degree
 * - ms: Master's degree
 * - phd: Doctoral degree
 */
export type MinEducation = "hs" | "aa" | "bs" | "ms" | "phd";

// ============================================================================
// JSONB TYPE INTERFACES
// ============================================================================

/**
 * Period-specific pricing summary with full cost breakdown.
 * Used to track costs across base and option periods.
 */
export interface PeriodSummary {
	/** Period sequence number (1 for base, 2+ for options) */
	periodNumber: number;
	/** Type of period (base, option_1, etc.) */
	periodType: PeriodType;
	/** Total direct labor cost for the period */
	laborCost: number;
	/** Total other direct costs for the period */
	odcCost: number;
	/** Total subcontractor costs for the period */
	subcontractCost: number;
	/** Total travel costs for the period */
	travelCost: number;
	/** Total material costs for the period */
	materialCost: number;
	/** Sum of all direct costs */
	totalDirectCost: number;
	/** Overhead amount applied */
	overhead: number;
	/** G&A rate applied (as decimal) */
	gaRate: number;
	/** Fee/profit rate applied (as decimal) */
	feeRate: number;
	/** Final total price for the period */
	totalPrice: number;
}

/**
 * Labor mix analysis entry for cost volume review.
 * Helps reviewers understand staffing composition and skill distribution.
 */
export interface LaborMixEntry {
	/** Labor category name */
	category: string;
	/** Percentage of total labor hours */
	percentage: number;
	/** Total hours for this category */
	hours: number;
}

/**
 * Risk factor affecting cost element with mitigation strategy.
 * Documents uncertainty and risk response in BOE narratives.
 */
export interface CostRiskFactor {
	/** Description of the risk */
	risk: string;
	/** Planned mitigation approach */
	mitigation: string;
	/** Estimated cost impact if risk materializes (positive = cost increase) */
	costImpact: number;
}

/**
 * Cost-technical alignment issue identified during analysis.
 * Highlights discrepancies between technical approach and pricing.
 */
export interface AlignmentIssue {
	/** Description of the alignment issue */
	issue: string;
	/** Severity classification */
	severity: AlignmentIssueSeverity;
	/** Suggested resolution approach */
	suggestion: string;
}

/**
 * Implied staffing derived from technical approach analysis.
 * Used to validate cost volume labor hours against technical scope.
 */
export interface ImpliedStaffingEntry {
	/** Role or labor category implied */
	role: string;
	/** Level of effort description (e.g., "full-time", "25%", "as needed") */
	effort: string;
	/** Estimated hours based on technical narrative */
	hours: number;
}

// ============================================================================
// LABOR CATEGORIES TABLE
// ============================================================================

/**
 * Labor rate cards for proposal costing.
 * Stores labor category definitions with direct and fully burdened rates,
 * escalation factors, and minimum qualification requirements.
 * Supports GSA Schedule pricing for applicable contracts.
 *
 * Government Context:
 * Labor categories must align with solicitation requirements and demonstrate
 * rate reasonableness. For GSA Schedule contracts, rates must not exceed
 * approved ceiling prices. DCAA may audit rate composition including
 * basis for burden application and escalation assumptions.
 */
export const laborCategories = pgTable("labor_categories", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Organization that owns this labor category definition */
	organizationId: uuid("organization_id").notNull(),

	// Category identification
	/** Labor category name (e.g., "Senior Software Engineer", "Project Manager II") */
	name: varchar("name", { length: 200 }).notNull(),
	/** Short code for the category (e.g., "SSE-3", "PM2") */
	code: varchar("code", { length: 50 }),
	/** Detailed description of role responsibilities and typical tasks */
	description: text("description"),

	// Rate information
	/** Hourly direct labor rate (base pay + fringe, excluding overhead) */
	directRate: real("direct_rate"),
	/** Fully burdened hourly rate (includes overhead, G&A) */
	fullyBurdenedRate: real("fully_burdened_rate"),
	/** Date when these rates become effective */
	effectiveDate: date("effective_date"),
	/** Date when these rates expire (null if no expiration) */
	expirationDate: date("expiration_date"),

	// Escalation factors
	/** Annual rate escalation percentage (e.g., 0.03 for 3% annual increase) */
	annualEscalation: real("annual_escalation"),

	// Qualification requirements
	/** Minimum education level required (BS, MS, PhD, etc.) */
	minEducation: varchar("min_education", { length: 20 }).$type<MinEducation>(),
	/** Minimum years of relevant experience required */
	minExperience: integer("min_experience"),
	/** Required certifications (e.g., PMP, CISSP, AWS Solutions Architect) */
	certifications: jsonb("certifications").$type<string[]>(),

	// GSA Schedule information
	/** GSA Schedule contract number (if applicable) */
	gsaScheduleNumber: varchar("gsa_schedule_number", { length: 50 }),
	/** GSA Special Item Number (SIN) for this category */
	gsaSin: varchar("gsa_sin", { length: 50 }),

	// Status
	/** Whether this labor category is active for current pricing */
	isActive: boolean("is_active").default(true),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// COST ELEMENTS TABLE
// ============================================================================

/**
 * Line items in the cost volume with full cost breakdown.
 * Each element represents a discrete cost in the Work Breakdown Structure,
 * traceable to technical requirements and documented with BOE narrative.
 *
 * Government Context:
 * Cost proposals must demonstrate traceability from technical requirements
 * to specific costs. Each line item requires a Basis of Estimate (BOE)
 * explaining the rationale for hours, rates, and costs. DCAA auditors
 * verify that labor hours align with technical approach and that rates
 * are consistent with approved rate structures.
 */
export const costElements = pgTable("cost_elements", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Organization that owns this cost element */
	organizationId: varchar("organization_id", { length: 100 }),

	/** Opportunity this cost element belongs to */
	opportunityId: uuid("opportunity_id").notNull(),

	// WBS linkage (Work Breakdown Structure)
	/** WBS code for hierarchical organization (e.g., "1.2.3", "3.1.1.2") */
	wbsCode: varchar("wbs_code", { length: 100 }),
	/** WBS element title/description */
	wbsTitle: varchar("wbs_title", { length: 500 }),
	/** Reference to technical proposal section this cost supports */
	technicalSectionId: uuid("technical_section_id"),

	// Cost element type
	/** Classification of cost type (labor, odc, subcontract, travel, material, other) */
	elementType: varchar("element_type", { length: 50 }).$type<CostElementType>(),

	// Labor details (when elementType = 'labor')
	/** Reference to labor category for rate lookup */
	laborCategoryId: uuid("labor_category_id").references(() => laborCategories.id),
	/** Denormalized labor category name for display */
	laborCategoryName: varchar("labor_category_name", { length: 200 }),
	/** Direct labor hours for this element */
	hours: real("hours"),
	/** Hourly rate applied (from labor category or override) */
	rate: real("rate"),
	/** Computed total labor cost (hours * rate) */
	laborCost: real("labor_cost"),

	// ODC details (when elementType = 'odc')
	/** Type of ODC (equipment, software, supplies, services) */
	odcType: varchar("odc_type", { length: 50 }).$type<OdcType>(),
	/** ODC dollar amount */
	odcAmount: real("odc_amount"),
	/** Detailed description of the ODC item */
	odcDescription: text("odc_description"),
	/** Vendor/supplier name */
	odcVendor: varchar("odc_vendor", { length: 200 }),
	/** Reference to vendor quote or catalog number */
	odcQuoteReference: varchar("odc_quote_reference", { length: 200 }),

	// Subcontractor details (when elementType = 'subcontract')
	/** Reference to subcontractor entity (if managing separately) */
	subcontractorId: uuid("subcontractor_id"),
	/** Subcontractor company name */
	subcontractorName: varchar("subcontractor_name", { length: 200 }),
	/** Total subcontract value */
	subcontractorCost: real("subcontractor_cost"),
	/** Description of subcontractor's role and scope */
	subcontractorRole: text("subcontractor_role"),

	// Travel details (when elementType = 'travel')
	/** Description of travel purpose and locations */
	travelDescription: text("travel_description"),
	/** Number of trips planned */
	travelTrips: integer("travel_trips"),
	/** Days per trip */
	travelDaysPerTrip: integer("travel_days_per_trip"),
	/** Estimated cost per trip (airfare + hotel + per diem) */
	travelCostPerTrip: real("travel_cost_per_trip"),
	/** Total computed travel cost */
	travelCost: real("travel_cost"),

	// Material details (when elementType = 'material')
	/** Description of materials/consumables */
	materialDescription: text("material_description"),
	/** Total material cost */
	materialCost: real("material_cost"),

	// Total
	/** Computed total cost for this element (varies by elementType) */
	totalCost: real("total_cost"),

	// Period/Option assignment
	/** Period sequence number (1 = base, 2+ = options) */
	periodNumber: integer("period_number"),
	/** Period type classification */
	periodType: varchar("period_type", { length: 50 }).$type<PeriodType>(),
	/** Period start date */
	periodStartDate: date("period_start_date"),
	/** Period end date */
	periodEndDate: date("period_end_date"),

	// Basis of Estimate (BOE) documentation
	/** Narrative explaining the cost estimate rationale */
	boeNarrative: text("boe_narrative"),
	/** Key assumptions underlying the estimate */
	assumptions: jsonb("assumptions").$type<string[]>(),
	/** Identified risks and their cost implications */
	riskFactors: jsonb("risk_factors").$type<CostRiskFactor[]>(),

	// Approval workflow
	/** Current approval status */
	status: varchar("status", { length: 50 }).default("draft").$type<CostElementStatus>(),
	/** User who approved this element */
	approvedBy: varchar("approved_by", { length: 200 }),
	/** Timestamp of approval */
	approvedAt: timestamp("approved_at", { withTimezone: true }),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// PRICING SUMMARIES TABLE
// ============================================================================

/**
 * Roll-up pricing summaries by opportunity.
 * Aggregates cost elements into period summaries with indirect rate application
 * and provides analysis metrics for proposal review.
 *
 * Government Context:
 * Pricing summaries enable quick evaluation of total price and cost composition.
 * Evaluators compare total proposed price against government estimates and
 * competitor bids. Labor mix analysis helps validate staffing approach and
 * skill level appropriateness for the work scope.
 */
export const pricingSummaries = pgTable("pricing_summaries", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Organization that owns this pricing summary */
	organizationId: varchar("organization_id", { length: 100 }),

	/** Opportunity this pricing summary belongs to */
	opportunityId: uuid("opportunity_id").notNull(),

	// Summary by period
	/** Detailed cost breakdown for each contract period */
	periodSummaries: jsonb("period_summaries").$type<PeriodSummary[]>(),

	// Grand totals across all periods
	/** Total labor cost across all periods */
	totalLaborCost: real("total_labor_cost"),
	/** Total ODC cost across all periods */
	totalOdcCost: real("total_odc_cost"),
	/** Total subcontract cost across all periods */
	totalSubcontractCost: real("total_subcontract_cost"),
	/** Total travel cost across all periods */
	totalTravelCost: real("total_travel_cost"),
	/** Total material cost across all periods */
	totalMaterialCost: real("total_material_cost"),
	/** Grand total of all direct costs */
	grandTotalDirectCost: real("grand_total_direct_cost"),
	/** Grand total proposed price (with all indirect rates and fee) */
	grandTotalPrice: real("grand_total_price"),

	// Indirect rates applied (snapshot at calculation time)
	/** Overhead rate used in calculation (as decimal) */
	overheadRate: real("overhead_rate"),
	/** G&A rate used in calculation (as decimal) */
	gaRate: real("ga_rate"),
	/** Fee/profit rate used in calculation (as decimal) */
	feeRate: real("fee_rate"),

	// Analysis metrics
	/** Average cost per Full-Time Equivalent (FTE) */
	costPerFte: real("cost_per_fte"),
	/** Weighted average labor rate across all categories */
	averageLaborRate: real("average_labor_rate"),
	/** Labor category distribution analysis */
	laborMixAnalysis: jsonb("labor_mix_analysis").$type<LaborMixEntry[]>(),

	// Calculation metadata
	/** When the summary was last calculated */
	calculatedAt: timestamp("calculated_at", { withTimezone: true }),
	/** User or system that triggered the calculation */
	calculatedBy: varchar("calculated_by", { length: 200 }),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// INDIRECT RATES TABLE
// ============================================================================

/**
 * Organization's indirect rate structure.
 * Stores overhead, G&A, fee, and escalation rates with approval tracking
 * for use in cost volume development.
 *
 * Government Context:
 * Indirect rates are subject to DCAA audit and must be substantiated with
 * forward pricing rate proposals or approved rate agreements. Contractors
 * must use appropriate rates based on contract type and demonstrate
 * consistency with their disclosed accounting practices. Rate approval
 * status (DCAA approved, provisional, forward pricing) affects proposal
 * risk assessment by government evaluators.
 */
export const indirectRates = pgTable("indirect_rates", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Organization that owns these rates */
	organizationId: uuid("organization_id").notNull(),

	// Rate identification
	/** Descriptive name for the rate (e.g., "Overhead - Engineering Pool", "G&A") */
	rateName: varchar("rate_name", { length: 200 }),
	/** Type of indirect rate */
	rateType: varchar("rate_type", { length: 50 }).$type<IndirectRateType>(),

	// Rate values
	/** Rate value as decimal (e.g., 0.45 for 45% overhead) */
	rateValue: real("rate_value"),
	/** Cost base to which the rate is applied */
	rateBase: varchar("rate_base", { length: 50 }).$type<IndirectRateBase>(),

	// Effective period
	/** Date when rate becomes effective */
	effectiveStartDate: date("effective_start_date"),
	/** Date when rate expires (null if ongoing) */
	effectiveEndDate: date("effective_end_date"),
	/** Fiscal year this rate applies to */
	fiscalYear: integer("fiscal_year"),

	// Approval status
	/** Whether the rate has been formally approved */
	isApproved: boolean("is_approved").default(false),
	/** Source of rate approval */
	approvalSource: varchar("approval_source", { length: 50 }).$type<RateApprovalSource>(),
	/** Date of approval */
	approvalDate: date("approval_date"),
	/** Reference to approval document (agreement number, memo reference) */
	approvalReference: varchar("approval_reference", { length: 200 }),

	// Status
	/** Whether this rate is currently active for proposal use */
	isActive: boolean("is_active").default(true),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// COST TECHNICAL TRACKING TABLE
// ============================================================================

/**
 * Alignment validation between cost and technical volumes.
 * Analyzes technical proposal sections to identify implied staffing and
 * validates that cost volume accurately reflects the technical approach.
 *
 * Government Context:
 * Evaluators assess "cost realism" by comparing proposed costs against the
 * technical approach. Misalignment (e.g., technical approach describing
 * senior engineer tasks but costing junior rates) can result in lower
 * technical scores or price adjustments. This table supports automated
 * alignment checking to identify and resolve discrepancies before submission.
 */
export const costTechnicalTracking = pgTable("cost_technical_tracking", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Organization that owns this alignment tracking record */
	organizationId: varchar("organization_id", { length: 100 }),

	/** Opportunity being analyzed */
	opportunityId: uuid("opportunity_id").notNull(),

	// Technical reference
	/** Reference to technical proposal section being analyzed */
	technicalSectionId: uuid("technical_section_id"),
	/** Section name for display */
	sectionName: varchar("section_name", { length: 300 }),
	/** Excerpt of technical content for context */
	sectionContent: text("section_content"),

	// Linked cost elements
	/** IDs of cost elements mapped to this technical section */
	linkedCostElementIds: jsonb("linked_cost_element_ids").$type<string[]>(),

	// Alignment analysis
	/** Whether matching costs were found for this section */
	hasMatchingCost: boolean("has_matching_cost").default(false),
	/** Alignment score (0-100) measuring cost-technical consistency */
	alignmentScore: real("alignment_score"),
	/** Identified alignment issues with severity and suggestions */
	alignmentIssues: jsonb("alignment_issues").$type<AlignmentIssue[]>(),

	// Staffing implications
	/** Staffing levels implied by the technical narrative */
	impliedStaffing: jsonb("implied_staffing").$type<ImpliedStaffingEntry[]>(),

	// Analysis metadata
	/** When the analysis was performed */
	analyzedAt: timestamp("analyzed_at", { withTimezone: true }),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// BOE TEMPLATES TABLE
// ============================================================================

/**
 * Reusable Basis of Estimate (BOE) narrative templates.
 * Provides standardized language for common cost justifications,
 * ensuring consistency and reducing authoring time.
 *
 * Government Context:
 * BOE narratives explain how cost estimates were developed and why they
 * are reasonable. Well-written BOEs demonstrate understanding of the work
 * scope, historical basis for estimates, and risk awareness. Templates
 * enable consistent, professional BOE development while allowing
 * customization for specific requirements.
 */
export const boeTemplates = pgTable("boe_templates", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Organization that owns this template */
	organizationId: uuid("organization_id").notNull(),

	// Template identification
	/** Template name for selection (e.g., "Software Development Labor BOE") */
	name: varchar("name", { length: 200 }),
	/** Cost element type this template applies to */
	costElementType: varchar("cost_element_type", { length: 50 }).$type<CostElementType>(),
	/** Specific category within the cost type (e.g., "engineering", "management") */
	category: varchar("category", { length: 100 }),

	// Template content
	/**
	 * Template narrative with placeholders for dynamic content.
	 * Supported placeholders: {{hours}}, {{rate}}, {{taskDescription}},
	 * {{laborCategory}}, {{period}}, {{wbsCode}}, {{totalCost}}
	 */
	templateText: text("template_text"),
	/** List of placeholder variables in the template for validation */
	placeholders: jsonb("placeholders").$type<string[]>(),

	// Usage tracking
	/** Number of times this template has been used */
	useCount: integer("use_count").default(0),
	/** Last time the template was used */
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

	// Status
	/** Whether the template is available for use */
	isActive: boolean("is_active").default(true),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

/**
 * Relations for laborCategories table.
 * Labor categories are referenced by cost elements for rate lookup.
 */
export const laborCategoriesRelations = relations(laborCategories, ({ many }) => ({
	/** Cost elements using this labor category */
	costElements: many(costElements),
}));

/**
 * Relations for costElements table.
 * Each labor-type cost element references a labor category for rate information.
 */
export const costElementsRelations = relations(costElements, ({ one }) => ({
	/** Labor category providing rates (for labor-type elements) */
	laborCategory: one(laborCategories, {
		fields: [costElements.laborCategoryId],
		references: [laborCategories.id],
	}),
}));

/**
 * Relations for pricingSummaries table.
 * Summaries aggregate cost elements for an opportunity but use JSONB
 * for period data rather than direct foreign keys.
 */
export const pricingSummariesRelations = relations(pricingSummaries, ({}) => ({}));

/**
 * Relations for indirectRates table.
 * Rates are organization-level and applied during pricing calculation
 * rather than through direct foreign keys.
 */
export const indirectRatesRelations = relations(indirectRates, ({}) => ({}));

/**
 * Relations for costTechnicalTracking table.
 * Tracks alignment through JSONB arrays of cost element IDs
 * rather than direct foreign key relationships.
 */
export const costTechnicalTrackingRelations = relations(costTechnicalTracking, ({}) => ({}));

/**
 * Relations for boeTemplates table.
 * Templates are standalone resources referenced by value during
 * cost element creation rather than foreign key relationships.
 */
export const boeTemplatesRelations = relations(boeTemplates, ({}) => ({}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/** Labor category select type */
export type LaborCategory = typeof laborCategories.$inferSelect;
/** Labor category insert type */
export type NewLaborCategory = typeof laborCategories.$inferInsert;

/** Cost element select type */
export type CostElement = typeof costElements.$inferSelect;
/** Cost element insert type */
export type NewCostElement = typeof costElements.$inferInsert;

/** Pricing summary select type */
export type PricingSummary = typeof pricingSummaries.$inferSelect;
/** Pricing summary insert type */
export type NewPricingSummary = typeof pricingSummaries.$inferInsert;

/** Indirect rate select type */
export type IndirectRate = typeof indirectRates.$inferSelect;
/** Indirect rate insert type */
export type NewIndirectRate = typeof indirectRates.$inferInsert;

/** Cost technical tracking select type */
export type CostTechnicalTracking = typeof costTechnicalTracking.$inferSelect;
/** Cost technical tracking insert type */
export type NewCostTechnicalTracking = typeof costTechnicalTracking.$inferInsert;

/** BOE template select type */
export type BoeTemplate = typeof boeTemplates.$inferSelect;
/** BOE template insert type */
export type NewBoeTemplate = typeof boeTemplates.$inferInsert;
