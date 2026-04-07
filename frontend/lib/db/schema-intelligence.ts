/**
 * Intelligence & Analysis Domain Schema - DocFusion
 *
 * Consolidated schema for all intelligence, analysis, and competitive
 * assessment capabilities. Merges the following domain schemas:
 *
 * - Pricing: Cost volume generation, labor categories, BOE templates
 * - Evidence: Proof point repository, claim analysis, evidence matrices
 * - PWin: Probability of win assessment, portfolio optimization
 * - Competitors: Competitive intelligence, discriminators, ghost themes
 * - Win Themes: Theme orchestration, injection points, coverage analysis
 * - Win/Loss: Debrief records, pattern analysis, proposal ROI
 * - Formatting: Government-specific formatting, accessibility compliance
 * - Graphics: Proposal graphics, templates, style guides
 * - Bibliography: Bibliography entries, citations, reference tracking
 */

import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { opportunities, documents } from "./schema";

// ============================================================================
// ============================================================================
//
//  SECTION: PRICING (Cost Volume Generator)
//
// ============================================================================
// ============================================================================

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
// PRICING JSONB TYPE INTERFACES
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
 */
export const pricingSummaries = pgTable("pricing_summaries", {
	id: uuid("id").primaryKey().defaultRandom(),

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
 */
export const costTechnicalTracking = pgTable("cost_technical_tracking", {
	id: uuid("id").primaryKey().defaultRandom(),

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
// PRICING RELATIONS
// ============================================================================

export const laborCategoriesRelations = relations(laborCategories, ({ many }) => ({
	costElements: many(costElements),
}));

export const costElementsRelations = relations(costElements, ({ one }) => ({
	laborCategory: one(laborCategories, {
		fields: [costElements.laborCategoryId],
		references: [laborCategories.id],
	}),
}));

export const pricingSummariesRelations = relations(pricingSummaries, ({}) => ({}));
export const indirectRatesRelations = relations(indirectRates, ({}) => ({}));
export const costTechnicalTrackingRelations = relations(costTechnicalTracking, ({}) => ({}));
export const boeTemplatesRelations = relations(boeTemplates, ({}) => ({}));

// ============================================================================
// PRICING TYPE EXPORTS
// ============================================================================

export type LaborCategory = typeof laborCategories.$inferSelect;
export type NewLaborCategory = typeof laborCategories.$inferInsert;
export type CostElement = typeof costElements.$inferSelect;
export type NewCostElement = typeof costElements.$inferInsert;
export type PricingSummary = typeof pricingSummaries.$inferSelect;
export type NewPricingSummary = typeof pricingSummaries.$inferInsert;
export type IndirectRate = typeof indirectRates.$inferSelect;
export type NewIndirectRate = typeof indirectRates.$inferInsert;
export type CostTechnicalTracking = typeof costTechnicalTracking.$inferSelect;
export type NewCostTechnicalTracking = typeof costTechnicalTracking.$inferInsert;
export type BoeTemplate = typeof boeTemplates.$inferSelect;
export type NewBoeTemplate = typeof boeTemplates.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: EVIDENCE (Proof Point Optimizer)
//
// ============================================================================
// ============================================================================

// ============================================================================
// EVIDENCE TYPE ENUMERATIONS
// ============================================================================

export type EvidenceType =
	| "metric"
	| "testimonial"
	| "case_study"
	| "certification"
	| "award"
	| "publication"
	| "capability";

export type EvidenceCategory =
	| "technical"
	| "management"
	| "past_performance"
	| "cost_efficiency"
	| "innovation";

export type EvidenceSourceType =
	| "internal"
	| "customer"
	| "third_party"
	| "government";

export type EvidenceStatus = "draft" | "approved" | "archived";

export type EvidenceUsageType =
	| "direct_quote"
	| "paraphrased"
	| "supporting"
	| "reference";

export type EvidenceEffectiveness = "strong" | "moderate" | "weak";

export type ClaimType =
	| "capability"
	| "performance"
	| "experience"
	| "commitment"
	| "promise";

export type ClaimEvidenceStrength = "none" | "weak" | "moderate" | "strong";
export type ClaimRiskLevel = "high" | "medium" | "low";

export type ClaimAnalysisStatus =
	| "open"
	| "in_progress"
	| "resolved"
	| "wont_fix";

export type ClaimResolution =
	| "evidence_added"
	| "claim_removed"
	| "claim_modified"
	| "accepted_as_is";

export type EvidenceMatrixType =
	| "evaluation_criteria"
	| "requirements"
	| "sections";

export type GapCriticality = "critical" | "major" | "minor" | "optional";
export type EvidenceTier = "gold" | "silver" | "bronze";

// ============================================================================
// EVIDENCE JSONB TYPE INTERFACES
// ============================================================================

export interface StrengthFactor {
	factor: string;
	score: number;
	notes?: string;
}

export interface ClaimLocation {
	pageNumber?: number;
	paragraphIndex?: number;
	charStart?: number;
	charEnd?: number;
}

export interface SuggestedEvidence {
	evidenceId: string;
	relevance: number;
	reason: string;
}

export interface EvidenceMatrixRow {
	id: string;
	name: string;
	weight?: number;
}

export interface EvidenceMatrixColumn {
	id: string;
	name: string;
}

export interface EvidenceMatrixCell {
	rowId: string;
	colId: string;
	evidenceIds: string[];
	coverageScore: number;
	notes?: string;
}

export interface EvidenceMatrixGap {
	rowId: string;
	rowName: string;
	missingCategories: string[];
	criticality: GapCriticality;
}

export interface StrengthImprovementSuggestion {
	dimension: string;
	current: number;
	potential: number;
	suggestion: string;
}

// ============================================================================
// EVIDENCE LIBRARY TABLE
// ============================================================================

export const evidenceLibrary = pgTable("evidence_library", {
	id: uuid("id").primaryKey().defaultRandom(),

	organizationId: uuid("organization_id").notNull(),

	title: varchar("title", { length: 500 }).notNull(),
	content: text("content").notNull(),
	summary: text("summary"),

	evidenceType: varchar("evidence_type", { length: 100 }).$type<EvidenceType>(),
	category: varchar("category", { length: 100 }).$type<EvidenceCategory>(),
	subcategory: varchar("subcategory", { length: 200 }),
	tags: jsonb("tags").$type<string[]>(),

	isQuantified: boolean("is_quantified").default(false),
	metric: varchar("metric", { length: 200 }),
	metricValue: varchar("metric_value", { length: 100 }),
	metricUnit: varchar("metric_unit", { length: 50 }),
	metricContext: text("metric_context"),

	sourceType: varchar("source_type", { length: 100 }).$type<EvidenceSourceType>(),
	sourceReference: text("source_reference"),
	sourceDate: date("source_date"),
	sourceVerified: boolean("source_verified").default(false),
	verificationNotes: text("verification_notes"),

	strengthScore: real("strength_score"),
	strengthFactors: jsonb("strength_factors").$type<StrengthFactor[]>(),

	relatedCapabilities: jsonb("related_capabilities").$type<string[]>(),
	relatedNaicsCodes: jsonb("related_naics_codes").$type<string[]>(),
	relatedAgencies: jsonb("related_agencies").$type<string[]>(),

	useCount: integer("use_count").default(0),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	lastUsedInOpportunityId: uuid("last_used_in_opportunity_id"),

	status: varchar("status", { length: 50 }).default("draft").$type<EvidenceStatus>(),
	approvedBy: varchar("approved_by", { length: 200 }),
	approvedAt: timestamp("approved_at", { withTimezone: true }),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// EVIDENCE USAGES TABLE
// ============================================================================

export const evidenceUsages = pgTable("evidence_usages", {
	id: uuid("id").primaryKey().defaultRandom(),

	evidenceId: uuid("evidence_id")
		.references(() => evidenceLibrary.id, { onDelete: "cascade" })
		.notNull(),

	opportunityId: uuid("opportunity_id"),
	documentId: uuid("document_id"),
	sectionId: uuid("section_id"),
	sectionName: varchar("section_name", { length: 300 }),

	usageType: varchar("usage_type", { length: 50 }).$type<EvidenceUsageType>(),
	usedText: text("used_text"),
	context: text("context"),

	effectiveness: varchar("effectiveness", { length: 50 }).$type<EvidenceEffectiveness>(),
	evaluatorFeedback: text("evaluator_feedback"),

	usedAt: timestamp("used_at", { withTimezone: true }).defaultNow(),
	usedBy: varchar("used_by", { length: 200 }),
});

// ============================================================================
// CLAIM ANALYSIS TABLE
// ============================================================================

export const claimAnalysis = pgTable("claim_analysis", {
	id: uuid("id").primaryKey().defaultRandom(),

	documentId: uuid("document_id"),
	sectionId: uuid("section_id"),
	opportunityId: uuid("opportunity_id"),

	claimText: text("claim_text").notNull(),
	claimType: varchar("claim_type", { length: 50 }).$type<ClaimType>(),
	claimLocation: jsonb("claim_location").$type<ClaimLocation>(),

	hasEvidence: boolean("has_evidence").default(false),
	evidenceStrength: varchar("evidence_strength", { length: 50 }).$type<ClaimEvidenceStrength>(),
	linkedEvidenceIds: jsonb("linked_evidence_ids").$type<string[]>(),

	suggestedEvidence: jsonb("suggested_evidence").$type<SuggestedEvidence[]>(),
	quantificationSuggestion: text("quantification_suggestion"),

	riskLevel: varchar("risk_level", { length: 50 }).$type<ClaimRiskLevel>(),
	evaluatorImpact: text("evaluator_impact"),

	status: varchar("status", { length: 50 }).default("open").$type<ClaimAnalysisStatus>(),
	resolution: varchar("resolution", { length: 50 }).$type<ClaimResolution>(),
	resolvedBy: varchar("resolved_by", { length: 200 }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true }),
	resolutionNotes: text("resolution_notes"),

	analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// EVIDENCE MATRICES TABLE
// ============================================================================

export const evidenceMatrices = pgTable("evidence_matrices", {
	id: uuid("id").primaryKey().defaultRandom(),

	opportunityId: uuid("opportunity_id"),

	name: varchar("name", { length: 300 }),
	matrixType: varchar("matrix_type", { length: 50 }).$type<EvidenceMatrixType>(),

	rows: jsonb("rows").$type<EvidenceMatrixRow[]>(),
	columns: jsonb("columns").$type<EvidenceMatrixColumn[]>(),
	cells: jsonb("cells").$type<EvidenceMatrixCell[]>(),

	overallCoverage: real("overall_coverage"),
	gapAnalysis: jsonb("gap_analysis").$type<EvidenceMatrixGap[]>(),

	generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
	generatedBy: varchar("generated_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// EVIDENCE STRENGTH ANALYSIS TABLE
// ============================================================================

export const evidenceStrengthAnalysis = pgTable("evidence_strength_analysis", {
	id: uuid("id").primaryKey().defaultRandom(),

	evidenceId: uuid("evidence_id")
		.references(() => evidenceLibrary.id, { onDelete: "cascade" })
		.notNull(),

	recencyScore: real("recency_score"),
	specificityScore: real("specificity_score"),
	quantificationScore: real("quantification_score"),
	verifiabilityScore: real("verifiability_score"),
	relevanceScore: real("relevance_score"),

	compositeScore: real("composite_score"),
	tier: varchar("tier", { length: 50 }).$type<EvidenceTier>(),

	improvementSuggestions: jsonb("improvement_suggestions").$type<StrengthImprovementSuggestion[]>(),

	analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// EVIDENCE RELATIONS
// ============================================================================

export const evidenceLibraryRelations = relations(evidenceLibrary, ({ many }) => ({
	usages: many(evidenceUsages),
	strengthAnalyses: many(evidenceStrengthAnalysis),
}));

export const evidenceUsagesRelations = relations(evidenceUsages, ({ one }) => ({
	evidence: one(evidenceLibrary, {
		fields: [evidenceUsages.evidenceId],
		references: [evidenceLibrary.id],
	}),
}));

export const claimAnalysisRelations = relations(claimAnalysis, ({}) => ({}));
export const evidenceMatricesRelations = relations(evidenceMatrices, ({}) => ({}));

export const evidenceStrengthAnalysisRelations = relations(evidenceStrengthAnalysis, ({ one }) => ({
	evidence: one(evidenceLibrary, {
		fields: [evidenceStrengthAnalysis.evidenceId],
		references: [evidenceLibrary.id],
	}),
}));

// ============================================================================
// EVIDENCE TYPE EXPORTS
// ============================================================================

export type Evidence = typeof evidenceLibrary.$inferSelect;
export type NewEvidence = typeof evidenceLibrary.$inferInsert;
export type EvidenceUsage = typeof evidenceUsages.$inferSelect;
export type NewEvidenceUsage = typeof evidenceUsages.$inferInsert;
export type ClaimAnalysisRecord = typeof claimAnalysis.$inferSelect;
export type NewClaimAnalysis = typeof claimAnalysis.$inferInsert;
export type EvidenceMatrix = typeof evidenceMatrices.$inferSelect;
export type NewEvidenceMatrix = typeof evidenceMatrices.$inferInsert;
export type EvidenceStrengthAnalysisRecord = typeof evidenceStrengthAnalysis.$inferSelect;
export type NewEvidenceStrengthAnalysis = typeof evidenceStrengthAnalysis.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: PWIN (Probability of Win)
//
// ============================================================================
// ============================================================================

export const pwinFactors = pgTable("pwin_factors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  factorName: varchar("factor_name", { length: 200 }).notNull(),
  factorCategory: varchar("factor_category", { length: 100 }).notNull(),
  description: text("description"),

  weight: real("weight").default(1),
  minScore: real("min_score").default(0),
  maxScore: real("max_score").default(10),

  winCorrelation: real("win_correlation"),

  scoringGuidelines: jsonb("scoring_guidelines").$type<{
    score: number;
    description: string;
  }[]>(),

  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const pwinAssessments = pgTable("pwin_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id"),
  organizationId: uuid("organization_id"),

  assessedAt: timestamp("assessed_at", { withTimezone: true }).defaultNow(),
  assessedBy: varchar("assessed_by", { length: 200 }),
  assessmentType: varchar("assessment_type", { length: 50 }),

  factorScores: jsonb("factor_scores").$type<{
    factorId: string;
    factorName: string;
    score: number;
    weight: number;
    notes?: string;
  }[]>().default([]),

  calculatedPwin: real("calculated_pwin"),
  previousPwin: real("previous_pwin"),
  pwinDelta: real("pwin_delta"),

  confidenceInterval: jsonb("confidence_interval").$type<{
    lower: number;
    upper: number;
    confidence: number;
  }>(),

  sensitivityAnalysis: jsonb("sensitivity_analysis").$type<{
    factorId: string;
    factorName: string;
    currentScore: number;
    impactIfImproved: number;
    improvementPotential: number;
  }[]>(),

  recommendations: jsonb("recommendations").$type<{
    recommendation: string;
    priority: "high" | "medium" | "low";
    factorId?: string;
    expectedImpact: number;
  }[]>().default([]),

  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const pwinModelPerformance = pgTable("pwin_model_performance", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  modelVersion: varchar("model_version", { length: 50 }).notNull(),
  modelType: varchar("model_type", { length: 50 }),

  accuracy: real("accuracy"),
  precision: real("precision"),
  recall: real("recall"),
  f1Score: real("f1_score"),
  auc: real("auc"),
  brierScore: real("brier_score"),

  calibrationData: jsonb("calibration_data").$type<{
    predictedBucket: number;
    actualWinRate: number;
    count: number;
  }[]>(),

  trainingSetSize: integer("training_set_size"),
  testSetSize: integer("test_set_size"),
  validationSetSize: integer("validation_set_size"),

  featureImportance: jsonb("feature_importance").$type<{
    factorId: string;
    factorName: string;
    importance: number;
    rank: number;
  }[]>(),

  crossValidationScores: jsonb("cross_validation_scores").$type<number[]>(),

  isActive: boolean("is_active").default(false),

  trainedAt: timestamp("trained_at", { withTimezone: true }).defaultNow(),
  trainedBy: varchar("trained_by", { length: 200 }),
});

export const portfolioOptimizations = pgTable("portfolio_optimizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  optimizationType: varchar("optimization_type", { length: 50 }),
  resourceConstraint: real("resource_constraint"),

  selectedOpportunities: jsonb("selected_opportunities").$type<{
    opportunityId: string;
    opportunityName: string;
    pwin: number;
    value: number;
    investmentRequired: number;
    expectedValue: number;
  }[]>(),

  totalExpectedValue: real("total_expected_value"),
  totalInvestment: real("total_investment"),
  portfolioPwin: real("portfolio_pwin"),
  diversificationScore: real("diversification_score"),

  improvementVsCurrent: real("improvement_vs_current"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 200 }),
});

// PWIN Relations
export const pwinFactorsRelations = relations(pwinFactors, ({ many }) => ({}));
export const pwinAssessmentsRelations = relations(pwinAssessments, ({ one }) => ({}));
export const pwinModelPerformanceRelations = relations(pwinModelPerformance, ({ one }) => ({}));
export const portfolioOptimizationsRelations = relations(portfolioOptimizations, ({ one }) => ({}));

// PWIN Type exports
export type PwinFactor = typeof pwinFactors.$inferSelect;
export type NewPwinFactor = typeof pwinFactors.$inferInsert;
export type PwinAssessment = typeof pwinAssessments.$inferSelect;
export type NewPwinAssessment = typeof pwinAssessments.$inferInsert;
export type PwinModelPerformance = typeof pwinModelPerformance.$inferSelect;
export type NewPwinModelPerformance = typeof pwinModelPerformance.$inferInsert;
export type PortfolioOptimization = typeof portfolioOptimizations.$inferSelect;
export type NewPortfolioOptimization = typeof portfolioOptimizations.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: COMPETITORS (Competitive Intelligence)
//
// ============================================================================
// ============================================================================

export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  // ===== BASIC COMPANY INFO =====
  name: varchar("name", { length: 500 }).notNull(),
  legalName: varchar("legal_name", { length: 500 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 200 }),
  website: text("website"),
  description: text("description"),
  logoUrl: text("logo_url"),

  // ===== FOUNDING & AGE =====
  foundedYear: integer("founded_year"),
  companyAge: integer("company_age"),

  // ===== CLASSIFICATION =====
  competitorType: varchar("competitor_type", { length: 100 }),
  companyType: varchar("company_type", { length: 200 }),
  primaryBusiness: varchar("primary_business", { length: 500 }),
  specialization: text("specialization"),
  sizeStandard: varchar("size_standard", { length: 50 }),

  // ===== CONTACT INFO =====
  linkedIn: text("linkedin"),
  email: varchar("email", { length: 500 }),
  phone: varchar("phone", { length: 100 }),
  physicalAddress: text("physical_address"),

  // ===== LEADERSHIP & TEAM =====
  ceoFounder: varchar("ceo_founder", { length: 300 }),
  ctoTechLead: varchar("cto_tech_lead", { length: 300 }),
  keyManagement: jsonb("key_management").$type<string[]>(),
  managementLinkedin: jsonb("management_linkedin").$type<string[]>(),
  teamSize: varchar("team_size", { length: 100 }),
  engineerCount: varchar("engineer_count", { length: 100 }),
  keyEngineers: jsonb("key_engineers").$type<string[]>(),
  notableAlumni: jsonb("notable_alumni").$type<string[]>(),

  // ===== FINANCIALS =====
  annualRevenue: varchar("annual_revenue", { length: 200 }),
  revenueRange: varchar("revenue_range", { length: 100 }),
  fundingRaised: varchar("funding_raised", { length: 200 }),
  investors: jsonb("investors").$type<string[]>(),

  // ===== PRODUCTS & TECHNOLOGY =====
  productsServices: text("products_services"),
  technologyStack: jsonb("technology_stack").$type<string[]>(),
  industriesServed: jsonb("industries_served").$type<string[]>(),

  // ===== CLIENTS & CONTRACTS =====
  notableClients: jsonb("notable_clients").$type<string[]>(),
  recentContracts: text("recent_contracts"),
  contractValues: varchar("contract_values", { length: 200 }),
  pursuingOpportunities: text("pursuing_opportunities"),

  // ===== PARTNERSHIPS & CERTIFICATIONS =====
  partnerships: jsonb("partnerships").$type<string[]>(),
  knownPartners: jsonb("known_partners").$type<string[]>(),
  certifications: jsonb("certifications").$type<string[]>(),
  awards: jsonb("awards").$type<string[]>(),

  // ===== NEWS & MEDIA =====
  newsMentions: jsonb("news_mentions").$type<string[]>(),
  recentNews: text("recent_news"),
  socialMediaPresence: jsonb("social_media_presence").$type<{
    platform: string;
    url?: string;
    followers?: string;
  }[]>(),

  // ===== COMPETITIVE ANALYSIS =====
  competitivePositioning: text("competitive_positioning"),
  marketShare: varchar("market_share", { length: 100 }),
  growthTrajectory: varchar("growth_trajectory", { length: 200 }),
  threatLevel: varchar("threat_level", { length: 50 }),
  strategicNotes: text("strategic_notes"),

  // ===== CAPABILITIES =====
  capabilities: jsonb("capabilities").$type<{
    area: string;
    strength: "strong" | "moderate" | "weak";
    notes?: string;
  }[]>(),
  contractVehicles: jsonb("contract_vehicles").$type<string[]>(),
  naicsCodes: jsonb("naics_codes").$type<string[]>(),

  // ===== STRENGTHS & WEAKNESSES =====
  strengths: jsonb("strengths").$type<string[]>(),
  weaknesses: jsonb("weaknesses").$type<string[]>(),

  // ===== PRICING INTELLIGENCE =====
  pricingTendency: varchar("pricing_tendency", { length: 100 }),
  averageWinPrice: real("average_win_price"),
  laborRateComparison: varchar("labor_rate_comparison", { length: 50 }),

  // ===== WIN/LOSS TRACKING =====
  winCount: integer("win_count").default(0),
  lossCount: integer("loss_count").default(0),
  winsAgainstUs: integer("wins_against_us").default(0),
  lossesToUs: integer("losses_to_us").default(0),

  // ===== INTELLIGENCE METADATA =====
  lastResearchedAt: timestamp("last_researched_at", { withTimezone: true }),
  lastUpdated: date("last_updated"),
  researchNotes: text("research_notes"),
  intelligenceQuality: varchar("intelligence_quality", { length: 50 }),
  dataSource: varchar("data_source", { length: 200 }),
  externalId: varchar("external_id", { length: 100 }),

  // ===== TIMESTAMPS =====
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const discriminators = pgTable("discriminators", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  statement: text("statement").notNull(),
  shortVersion: varchar("short_version", { length: 200 }),
  proofPoints: jsonb("proof_points").$type<string[]>(),

  discriminatorType: varchar("discriminator_type", { length: 100 }),
  category: varchar("category", { length: 200 }),

  supportingEvidence: jsonb("supporting_evidence").$type<{
    type: "contract" | "metric" | "testimonial" | "case_study";
    description: string;
    reference?: string;
  }[]>(),

  effectiveAgainst: jsonb("effective_against").$type<string[]>(),

  applicableOpportunityTypes: jsonb("applicable_opportunity_types").$type<string[]>(),
  applicableNaicsCodes: jsonb("applicable_naics_codes").$type<string[]>(),

  useCount: integer("use_count").default(0),
  winCount: integer("win_count").default(0),
  effectivenessScore: real("effectiveness_score"),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const ghostThemes = pgTable("ghost_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id").references(() => competitors.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id"),

  weakness: text("weakness").notNull(),
  ghostLanguage: text("ghost_language").notNull(),
  suggestedPlacement: text("suggested_placement"),

  category: varchar("category", { length: 100 }),

  isEthical: boolean("is_ethical").default(true),
  complianceNotes: text("compliance_notes"),

  useCount: integer("use_count").default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const competitorOpportunities = pgTable("competitor_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitorId: uuid("competitor_id").references(() => competitors.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),

  likelihoodToBid: varchar("likelihood_to_bid", { length: 50 }),
  role: varchar("role", { length: 50 }),
  teamingPartners: jsonb("teaming_partners").$type<string[]>(),

  intelligenceSource: varchar("intelligence_source", { length: 200 }),
  notes: text("notes"),

  outcome: varchar("outcome", { length: 50 }),
  outcomeNotes: text("outcome_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const competitiveAnalyses = pgTable("competitive_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),

  strengths: jsonb("strengths").$type<string[]>(),
  weaknesses: jsonb("weaknesses").$type<string[]>(),
  opportunityFactors: jsonb("opportunity_factors").$type<string[]>(),
  threats: jsonb("threats").$type<string[]>(),

  ourPosition: varchar("our_position", { length: 100 }),
  primaryDifferentiators: jsonb("primary_differentiators").$type<string[]>(),
  competitiveGaps: jsonb("competitive_gaps").$type<string[]>(),

  winStrategy: text("win_strategy"),
  pricingStrategy: varchar("pricing_strategy", { length: 100 }),

  aiInsights: jsonb("ai_insights").$type<{
    insight: string;
    confidence: number;
    source: string;
  }[]>(),

  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
  analyzedBy: varchar("analyzed_by", { length: 200 }),
  isOutdated: boolean("is_outdated").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Competitor Relations
export const competitorsRelations = relations(competitors, ({ many }) => ({
  ghostThemes: many(ghostThemes),
  opportunities: many(competitorOpportunities),
}));

export const ghostThemesRelations = relations(ghostThemes, ({ one }) => ({
  competitor: one(competitors, {
    fields: [ghostThemes.competitorId],
    references: [competitors.id],
  }),
}));

export const competitorOpportunitiesRelations = relations(competitorOpportunities, ({ one }) => ({
  competitor: one(competitors, {
    fields: [competitorOpportunities.competitorId],
    references: [competitors.id],
  }),
  opportunity: one(opportunities, {
    fields: [competitorOpportunities.opportunityId],
    references: [opportunities.id],
  }),
}));

export const competitiveAnalysesRelations = relations(competitiveAnalyses, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [competitiveAnalyses.opportunityId],
    references: [opportunities.id],
  }),
}));

// Competitor Type exports
export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
export type Discriminator = typeof discriminators.$inferSelect;
export type NewDiscriminator = typeof discriminators.$inferInsert;
export type GhostTheme = typeof ghostThemes.$inferSelect;
export type NewGhostTheme = typeof ghostThemes.$inferInsert;
export type CompetitorOpportunity = typeof competitorOpportunities.$inferSelect;
export type CompetitiveAnalysis = typeof competitiveAnalyses.$inferSelect;


// ============================================================================
// ============================================================================
//
//  SECTION: WIN THEMES (Win Theme Orchestration Engine)
//
// ============================================================================
// ============================================================================

// ============================================================================
// WIN THEME TYPE ENUMERATIONS
// ============================================================================

export type ThemeType =
	| "value_prop"
	| "differentiator"
	| "proof_point"
	| "risk_mitigation"
	| "customer_focus"
	| "innovation";

export type ThemeStrength = "strong" | "moderate" | "weak" | "implicit";
export type OccurrenceType = "explicit" | "rephrased" | "supporting" | "related";
export type InjectionType = "insert" | "replace" | "enhance";
export type InjectionStatus = "pending" | "accepted" | "rejected" | "modified";
export type IntelligenceConfidence = "high" | "medium" | "low";

export type IntelligenceSourceType =
	| "bid_intel"
	| "market_research"
	| "past_competition"
	| "public_sources"
	| "customer_feedback";

export type GapSeverity = "critical" | "major" | "minor" | "suggestion";

export type RecommendationType =
	| "add_theme"
	| "strengthen_theme"
	| "add_occurrence"
	| "remove_redundancy"
	| "rebalance_distribution"
	| "ghost_opportunity";

// ============================================================================
// WIN THEME JSONB TYPE INTERFACES
// ============================================================================

export interface VolumeCoverage {
	volume: string;
	coverage: number;
	themeCount: number;
}

export interface ThemeDistribution {
	themeId: string;
	occurrenceCount: number;
	avgStrength: number;
	coverage: number;
}

export interface ThemeGap {
	sectionId: string;
	sectionName: string;
	missingThemes: string[];
	severity: GapSeverity;
}

export interface ThemeRecommendation {
	type: RecommendationType;
	priority: string;
	description: string;
	affectedThemeId?: string;
	targetSectionId?: string;
}

export interface GhostThemeOpportunity {
	weakness: string;
	ourStrength: string;
	suggestedTheme: string;
}

// ============================================================================
// WIN THEMES TABLE
// ============================================================================

export const winThemes = pgTable("win_themes", {
	id: uuid("id").primaryKey().defaultRandom(),

	opportunityId: uuid("opportunity_id").notNull(),

	themeStatement: text("theme_statement").notNull(),
	shortVersion: varchar("short_version", { length: 200 }),

	themeType: varchar("theme_type", { length: 100 }).$type<ThemeType>(),
	priority: integer("priority").default(1),

	supportingEvidence: jsonb("supporting_evidence").$type<string[]>(),
	relatedProjects: jsonb("related_projects").$type<string[]>(),

	evaluationCriteriaIds: jsonb("evaluation_criteria_ids").$type<string[]>(),

	ghostTheme: text("ghost_theme"),
	targetCompetitor: varchar("target_competitor", { length: 200 }),

	keywords: jsonb("keywords").$type<string[]>(),
	variations: jsonb("variations").$type<string[]>(),

	targetSections: jsonb("target_sections").$type<string[]>(),
	minOccurrences: integer("min_occurrences").default(3),

	isActive: boolean("is_active").default(true),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const themeOccurrences = pgTable("theme_occurrences", {
	id: uuid("id").primaryKey().defaultRandom(),

	themeId: uuid("theme_id")
		.references(() => winThemes.id, { onDelete: "cascade" })
		.notNull(),

	documentId: uuid("document_id").notNull(),
	sectionId: uuid("section_id"),
	sectionName: varchar("section_name", { length: 300 }),
	pageNumber: integer("page_number"),
	paragraphIndex: integer("paragraph_index"),

	textExcerpt: text("text_excerpt"),
	strength: varchar("strength", { length: 50 }).$type<ThemeStrength>(),
	occurrenceType: varchar("occurrence_type", { length: 50 }).$type<OccurrenceType>(),

	detectedAt: timestamp("detected_at", { withTimezone: true }),
	confidence: real("confidence"),
	aiSuggested: boolean("ai_suggested").default(false),
	userVerified: boolean("user_verified").default(false),
	verifiedBy: varchar("verified_by", { length: 200 }),
	verifiedAt: timestamp("verified_at", { withTimezone: true }),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const themeInjectionPoints = pgTable("theme_injection_points", {
	id: uuid("id").primaryKey().defaultRandom(),

	themeId: uuid("theme_id")
		.references(() => winThemes.id, { onDelete: "cascade" })
		.notNull(),

	documentId: uuid("document_id").notNull(),
	sectionId: uuid("section_id"),
	sectionName: varchar("section_name", { length: 300 }),
	pageNumber: integer("page_number"),
	textContext: text("text_context"),

	suggestedText: text("suggested_text").notNull(),
	injectionType: varchar("injection_type", { length: 50 }).$type<InjectionType>(),
	rationale: text("rationale"),

	impactScore: real("impact_score"),
	relevanceScore: real("relevance_score"),
	priorityScore: real("priority_score"),

	status: varchar("status", { length: 50 }).default("pending").$type<InjectionStatus>(),
	acceptedText: text("accepted_text"),
	acceptedBy: varchar("accepted_by", { length: 200 }),
	acceptedAt: timestamp("accepted_at", { withTimezone: true }),
	reviewNotes: text("review_notes"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const themeAnalysisResults = pgTable("theme_analysis_results", {
	id: uuid("id").primaryKey().defaultRandom(),

	opportunityId: uuid("opportunity_id").notNull(),

	analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
	analyzedBy: varchar("analyzed_by", { length: 200 }),
	documentVersionId: uuid("document_version_id"),
	analysisRunId: uuid("analysis_run_id"),

	totalThemes: integer("total_themes"),
	averageCoverage: real("average_coverage"),
	consistencyScore: real("consistency_score"),
	winProbabilityImpact: real("win_probability_impact"),

	coverageByVolume: jsonb("coverage_by_volume").$type<VolumeCoverage[]>(),
	themeDistribution: jsonb("theme_distribution").$type<ThemeDistribution[]>(),

	gaps: jsonb("gaps").$type<ThemeGap[]>(),
	criticalGapCount: integer("critical_gap_count").default(0),
	majorGapCount: integer("major_gap_count").default(0),
	minorGapCount: integer("minor_gap_count").default(0),

	recommendations: jsonb("recommendations").$type<ThemeRecommendation[]>(),
	highPriorityRecommendations: integer("high_priority_recommendations").default(0),

	previousAnalysisId: uuid("previous_analysis_id"),
	coverageChange: real("coverage_change"),
	consistencyChange: real("consistency_change"),

	analysisDurationMs: integer("analysis_duration_ms"),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const competitorProfiles = pgTable("competitor_profiles", {
	id: uuid("id").primaryKey().defaultRandom(),

	opportunityId: uuid("opportunity_id").notNull(),

	competitorName: varchar("competitor_name", { length: 200 }).notNull(),
	competitorDescription: text("competitor_description"),

	competitorStrengths: jsonb("competitor_strengths").$type<string[]>(),
	competitorWeaknesses: jsonb("competitor_weaknesses").$type<string[]>(),
	competitorThemes: jsonb("competitor_themes").$type<string[]>(),

	ourDifferentiators: jsonb("our_differentiators").$type<string[]>(),
	ghostThemeOpportunities: jsonb("ghost_theme_opportunities").$type<GhostThemeOpportunity[]>(),

	sourceType: varchar("source_type", { length: 100 }).$type<IntelligenceSourceType>(),
	confidenceLevel: varchar("confidence_level", { length: 50 }).$type<IntelligenceConfidence>(),
	sourceNotes: text("source_notes"),
	intelligenceDate: timestamp("intelligence_date", { withTimezone: true }),

	estimatedPriceRange: jsonb("estimated_price_range").$type<{ min?: number; max?: number }>(),
	expectedTeaming: jsonb("expected_teaming").$type<string[]>(),
	isIncumbent: boolean("is_incumbent").default(false),

	isActive: boolean("is_active").default(true),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Win Theme Relations
export const winThemesRelations = relations(winThemes, ({ many }) => ({
	occurrences: many(themeOccurrences),
	injectionPoints: many(themeInjectionPoints),
}));

export const themeOccurrencesRelations = relations(themeOccurrences, ({ one }) => ({
	theme: one(winThemes, {
		fields: [themeOccurrences.themeId],
		references: [winThemes.id],
	}),
}));

export const themeInjectionPointsRelations = relations(themeInjectionPoints, ({ one }) => ({
	theme: one(winThemes, {
		fields: [themeInjectionPoints.themeId],
		references: [winThemes.id],
	}),
}));

export const themeAnalysisResultsRelations = relations(themeAnalysisResults, ({ one }) => ({
	previousAnalysis: one(themeAnalysisResults, {
		fields: [themeAnalysisResults.previousAnalysisId],
		references: [themeAnalysisResults.id],
		relationName: "analysis_history",
	}),
}));

export const competitorProfilesRelations = relations(competitorProfiles, ({}) => ({}));

// Win Theme Type exports
export type WinTheme = typeof winThemes.$inferSelect;
export type NewWinTheme = typeof winThemes.$inferInsert;
export type ThemeOccurrence = typeof themeOccurrences.$inferSelect;
export type NewThemeOccurrence = typeof themeOccurrences.$inferInsert;
export type ThemeInjectionPoint = typeof themeInjectionPoints.$inferSelect;
export type NewThemeInjectionPoint = typeof themeInjectionPoints.$inferInsert;
export type ThemeAnalysisResult = typeof themeAnalysisResults.$inferSelect;
export type NewThemeAnalysisResult = typeof themeAnalysisResults.$inferInsert;
export type CompetitorProfile = typeof competitorProfiles.$inferSelect;
export type NewCompetitorProfile = typeof competitorProfiles.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: WIN/LOSS (Win/Loss Tracking & Analysis)
//
// ============================================================================
// ============================================================================

export const debriefs = pgTable("debriefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id"),
  organizationId: uuid("organization_id"),

  outcome: varchar("outcome", { length: 50 }).notNull(),

  debriefDate: timestamp("debrief_date", { withTimezone: true }),
  debriefType: varchar("debrief_type", { length: 50 }),
  debriefRequestedAt: timestamp("debrief_requested_at", { withTimezone: true }),
  debriefReceivedAt: timestamp("debrief_received_at", { withTimezone: true }),

  technicalScore: real("technical_score"),
  technicalMaxScore: real("technical_max_score"),
  managementScore: real("management_score"),
  managementMaxScore: real("management_max_score"),
  pastPerfScore: real("past_perf_score"),
  pastPerfMaxScore: real("past_perf_max_score"),
  costScore: real("cost_score"),
  costMaxScore: real("cost_max_score"),
  overallRanking: integer("overall_ranking"),
  totalBidders: integer("total_bidders"),

  winnerName: varchar("winner_name", { length: 500 }),
  winnerId: uuid("winner_id"),
  winningPrice: real("winning_price"),

  evaluatorFeedback: text("evaluator_feedback"),
  strengthsIdentified: jsonb("strengths_identified").$type<string[]>().default([]),
  weaknessesIdentified: jsonb("weaknesses_identified").$type<string[]>().default([]),

  internalAnalysis: text("internal_analysis"),
  lessonsLearned: jsonb("lessons_learned").$type<string[]>().default([]),
  actionItems: jsonb("action_items").$type<{
    id: string;
    item: string;
    assignee: string;
    dueDate: string;
    status: "pending" | "in_progress" | "completed";
    completedAt?: string;
  }[]>().default([]),

  proposalInvestment: real("proposal_investment"),
  contractValue: real("contract_value"),

  debriefDocument: text("debrief_document"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 200 }),
});

export const winLossPatterns = pgTable("win_loss_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  patternType: varchar("pattern_type", { length: 100 }).notNull(),
  patternName: varchar("pattern_name", { length: 200 }).notNull(),
  description: text("description"),

  occurrenceCount: integer("occurrence_count").default(0),
  winCorrelation: real("win_correlation"),
  lossCorrelation: real("loss_correlation"),
  confidence: real("confidence"),

  relatedDebriefs: jsonb("related_debriefs").$type<string[]>().default([]),
  relatedCompetitors: jsonb("related_competitors").$type<string[]>().default([]),
  relatedAgencies: jsonb("related_agencies").$type<string[]>().default([]),

  recommendations: jsonb("recommendations").$type<{
    recommendation: string;
    priority: "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
  }[]>().default([]),

  isActive: boolean("is_active").default(true),
  lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const proposalROI = pgTable("proposal_roi", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

  totalProposals: integer("total_proposals").default(0),
  totalWins: integer("total_wins").default(0),
  totalLosses: integer("total_losses").default(0),
  totalNoAward: integer("total_no_award").default(0),

  totalInvestment: real("total_investment").default(0),
  totalContractValue: real("total_contract_value").default(0),
  totalPipeline: real("total_pipeline").default(0),

  winRate: real("win_rate"),
  averageProposalCost: real("average_proposal_cost"),
  roi: real("roi"),
  costPerWin: real("cost_per_win"),

  metricsByAgency: jsonb("metrics_by_agency").$type<Record<string, {
    proposals: number;
    wins: number;
    winRate: number;
    revenue: number;
  }>>(),
  metricsBySize: jsonb("metrics_by_size").$type<Record<string, {
    proposals: number;
    wins: number;
    winRate: number;
    revenue: number;
  }>>(),
  metricsByCompetitor: jsonb("metrics_by_competitor").$type<Record<string, {
    encounters: number;
    wins: number;
    losses: number;
  }>>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Win/Loss Relations
export const debriefsRelations = relations(debriefs, ({ one }) => ({
}));

export const winLossPatternsRelations = relations(winLossPatterns, ({ one }) => ({
}));

// Win/Loss Type exports
export type Debrief = typeof debriefs.$inferSelect;
export type NewDebrief = typeof debriefs.$inferInsert;
export type WinLossPattern = typeof winLossPatterns.$inferSelect;
export type NewWinLossPattern = typeof winLossPatterns.$inferInsert;
export type ProposalROI = typeof proposalROI.$inferSelect;
export type NewProposalROI = typeof proposalROI.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: FORMATTING (Government-Specific Formatting Engine)
//
// ============================================================================
// ============================================================================

// ============================================================================
// FORMATTING TYPE ENUMERATIONS
// ============================================================================

export type PageSize = "letter" | "legal" | "A4";
export type PageOrientation = "portrait" | "landscape";
export type AccessibilityLevel = "WCAG_AA" | "WCAG_AAA" | "Section_508";

export type TocEntryType =
	| "chapter"
	| "section"
	| "subsection"
	| "figure"
	| "table"
	| "acronym"
	| "appendix"
	| "attachment"
	| "exhibit";

export type ValidationSeverity = "critical" | "major" | "minor" | "info";

export type ValidationIssueType =
	| "page_limit_exceeded"
	| "font_non_compliant"
	| "margin_violation"
	| "spacing_violation"
	| "missing_header"
	| "missing_footer"
	| "missing_page_number"
	| "accessibility_violation"
	| "missing_toc_entry"
	| "broken_cross_reference"
	| "image_resolution_low"
	| "image_missing_alt_text"
	| "table_accessibility"
	| "color_contrast"
	| "heading_hierarchy"
	| "orphan_widow"
	| "custom";

// ============================================================================
// FORMATTING JSONB TYPE INTERFACES
// ============================================================================

export interface PageMargins {
	top: number;
	bottom: number;
	left: number;
	right: number;
	gutter?: number;
}

export interface PageLimitSpec {
	volume?: string;
	limit: number;
	excludes?: string[];
	foldoutMultiplier?: number;
	notes?: string;
}

export interface HeaderFormat {
	enabled: boolean;
	height?: number;
	leftContent?: string;
	centerContent?: string;
	rightContent?: string;
	font?: string;
	fontSize?: number;
	includeLine?: boolean;
	differentFirstPage?: boolean;
	firstPageContent?: {
		leftContent?: string;
		centerContent?: string;
		rightContent?: string;
	};
	differentOddEven?: boolean;
}

export interface FooterFormat {
	enabled: boolean;
	height?: number;
	leftContent?: string;
	centerContent?: string;
	rightContent?: string;
	font?: string;
	fontSize?: number;
	includeLine?: boolean;
	differentFirstPage?: boolean;
	firstPageContent?: {
		leftContent?: string;
		centerContent?: string;
		rightContent?: string;
	};
	proprietaryNotice?: string;
}

export interface PageNumberFormat {
	style: "arabic" | "roman_lower" | "roman_upper" | "alpha_lower" | "alpha_upper";
	startAt?: number;
	prefix?: string;
	suffix?: string;
	position: "header" | "footer";
	alignment: "left" | "center" | "right";
	includeTotal?: boolean;
	frontMatterStyle?: "roman_lower" | "roman_upper" | "none";
	restartAfterFrontMatter?: boolean;
}

export interface SectionNumberFormat {
	style: "decimal" | "alpha_upper" | "alpha_lower" | "roman_upper" | "roman_lower";
	separator: string;
	maxDepth?: number;
	trailingSeparator?: boolean;
	bold?: boolean;
	levelFormats?: {
		level: number;
		style: "decimal" | "alpha_upper" | "alpha_lower" | "roman_upper" | "roman_lower";
		prefix?: string;
		suffix?: string;
	}[];
}

export interface ValidationIssue {
	type: ValidationIssueType;
	severity: ValidationSeverity;
	message: string;
	location?: string;
	suggestion?: string;
	requirementRef?: string;
	autoFixable?: boolean;
}

export interface AccessibilityIssue {
	criterion: string;
	description: string;
	element?: string;
	impact: string;
	remediation?: string;
}

export interface CustomFormatSettings {
	pageSize?: PageSize;
	orientation?: PageOrientation;
	margins?: Partial<PageMargins>;
	bodyFont?: string;
	bodyFontSize?: number;
	headingFont?: string;
	lineSpacing?: number;
	headerFormat?: Partial<HeaderFormat>;
	footerFormat?: Partial<FooterFormat>;
	pageNumberFormat?: Partial<PageNumberFormat>;
	sectionNumberFormat?: Partial<SectionNumberFormat>;
	pageLimits?: PageLimitSpec[];
	frontMatterOrder?: string[];
	customStyles?: Record<string, string>;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// FORMAT TEMPLATES TABLE
// ============================================================================

export const formatTemplates = pgTable("format_templates", {
	id: uuid("id").primaryKey().defaultRandom(),

	name: varchar("name", { length: 200 }).notNull(),
	description: text("description"),

	agencyCode: varchar("agency_code", { length: 50 }),
	agencyName: varchar("agency_name", { length: 200 }),
	subAgency: varchar("sub_agency", { length: 200 }),
	contractVehicle: varchar("contract_vehicle", { length: 200 }),

	pageSize: varchar("page_size", { length: 20 }).default("letter").$type<PageSize>(),
	orientation: varchar("orientation", { length: 20 }).default("portrait").$type<PageOrientation>(),
	margins: jsonb("margins").$type<PageMargins>().default({
		top: 1.0,
		bottom: 1.0,
		left: 1.0,
		right: 1.0,
	}),

	bodyFont: varchar("body_font", { length: 100 }).default("Times New Roman"),
	bodyFontSize: real("body_font_size").default(12),
	headingFont: varchar("heading_font", { length: 100 }).default("Arial"),
	lineSpacing: real("line_spacing").default(1.0),
	minimumFontSize: real("minimum_font_size").default(10),
	allowFontEmbedding: boolean("allow_font_embedding").default(true),

	pageLimits: jsonb("page_limits").$type<PageLimitSpec[]>(),

	headerFormat: jsonb("header_format").$type<HeaderFormat>().default({
		enabled: true,
		height: 0.5,
		rightContent: "{solicitation_number}",
	}),
	footerFormat: jsonb("footer_format").$type<FooterFormat>().default({
		enabled: true,
		height: 0.5,
		centerContent: "Page {page_number}",
		rightContent: "Use or disclosure of data contained on this sheet is subject to the restriction on the title page.",
	}),

	pageNumberFormat: jsonb("page_number_format").$type<PageNumberFormat>().default({
		style: "arabic",
		position: "footer",
		alignment: "center",
		includeTotal: false,
		frontMatterStyle: "roman_lower",
		restartAfterFrontMatter: true,
	}),
	sectionNumberFormat: jsonb("section_number_format").$type<SectionNumberFormat>().default({
		style: "decimal",
		separator: ".",
		maxDepth: 4,
		trailingSeparator: false,
	}),

	frontMatterOrder: jsonb("front_matter_order").$type<string[]>().default([
		"cover_page",
		"table_of_contents",
		"list_of_figures",
		"list_of_tables",
		"list_of_acronyms",
		"executive_summary",
	]),
	requiredSections: jsonb("required_sections").$type<string[]>(),
	appendixNaming: varchar("appendix_naming", { length: 50 }).default("Appendix {alpha_upper}"),

	requiresAccessibility: boolean("requires_accessibility").default(true),
	accessibilityLevel: varchar("accessibility_level", { length: 50 })
		.default("Section_508")
		.$type<AccessibilityLevel>(),
	accessibilityRequirements: jsonb("accessibility_requirements").$type<string[]>(),

	minimumImageResolution: integer("minimum_image_resolution").default(300),
	requireImageAltText: boolean("require_image_alt_text").default(true),
	maxImageSizeKb: integer("max_image_size_kb"),
	allowedImageFormats: jsonb("allowed_image_formats").$type<string[]>().default([
		"png",
		"jpg",
		"jpeg",
		"gif",
		"svg",
	]),

	tableBorderStyle: varchar("table_border_style", { length: 50 }).default("solid"),
	requireTableHeaders: boolean("require_table_headers").default(true),
	maxTableWidthPercent: real("max_table_width_percent").default(100),

	preferredOutputFormat: varchar("preferred_output_format", { length: 20 }).default("pdf"),
	pdfACompliance: varchar("pdfa_compliance", { length: 10 }),
	embedFontsInPdf: boolean("embed_fonts_in_pdf").default(true),

	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),
	isSystem: boolean("is_system").default(false),

	version: varchar("version", { length: 20 }).default("1.0"),
	derivedFromId: uuid("derived_from_id"),

	organizationId: uuid("organization_id"),

	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const documentFormats = pgTable("document_formats", {
	id: uuid("id").primaryKey().defaultRandom(),

	documentId: uuid("document_id").notNull(),
	templateId: uuid("template_id").references(() => formatTemplates.id, { onDelete: "set null" }),

	overrides: jsonb("overrides").$type<CustomFormatSettings>(),
	hasOverrides: boolean("has_overrides").default(false),

	appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow(),
	appliedBy: varchar("applied_by", { length: 200 }),

	isValid: boolean("is_valid"),
	lastValidationId: uuid("last_validation_id"),
	lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),

	isLocked: boolean("is_locked").default(false),
	lockReason: varchar("lock_reason", { length: 500 }),
	lockedAt: timestamp("locked_at", { withTimezone: true }),
	lockedBy: varchar("locked_by", { length: 200 }),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const formatValidations = pgTable("format_validations", {
	id: uuid("id").primaryKey().defaultRandom(),

	documentId: uuid("document_id").notNull(),
	templateId: uuid("template_id").references(() => formatTemplates.id, { onDelete: "set null" }),

	validatedAt: timestamp("validated_at", { withTimezone: true }).defaultNow(),
	validatedBy: varchar("validated_by", { length: 200 }),
	validationType: varchar("validation_type", { length: 50 }).default("full"),
	documentVersionId: uuid("document_version_id"),

	isValid: boolean("is_valid").notNull(),
	overallScore: real("overall_score"),
	summary: text("summary"),

	issues: jsonb("issues").$type<ValidationIssue[]>().default([]),
	criticalIssueCount: integer("critical_issue_count").default(0),
	majorIssueCount: integer("major_issue_count").default(0),
	minorIssueCount: integer("minor_issue_count").default(0),
	infoIssueCount: integer("info_issue_count").default(0),

	pageCount: integer("page_count"),
	pageLimit: integer("page_limit"),
	pageCountValid: boolean("page_count_valid"),
	pageCountsByVolume: jsonb("page_counts_by_volume").$type<Record<string, number>>(),
	excludedPageCount: integer("excluded_page_count"),

	accessibilityScore: real("accessibility_score"),
	accessibilityPassed: boolean("accessibility_passed"),
	accessibilityIssues: jsonb("accessibility_issues").$type<AccessibilityIssue[]>().default([]),
	accessibilityViolationCount: integer("accessibility_violation_count").default(0),

	fontCompliance: boolean("font_compliance"),
	fontsUsed: jsonb("fonts_used").$type<string[]>(),
	nonCompliantFonts: jsonb("non_compliant_fonts").$type<string[]>(),

	marginCompliance: boolean("margin_compliance"),
	marginViolationPages: jsonb("margin_violation_pages").$type<number[]>(),

	spacingCompliance: boolean("spacing_compliance"),
	spacingViolationSections: jsonb("spacing_violation_sections").$type<string[]>(),

	headerCompliance: boolean("header_compliance"),
	footerCompliance: boolean("footer_compliance"),
	headerFooterIssuePages: jsonb("header_footer_issue_pages").$type<number[]>(),

	imageCount: integer("image_count"),
	imagesMissingAltText: integer("images_missing_alt_text").default(0),
	imagesLowResolution: integer("images_low_resolution").default(0),

	tableCount: integer("table_count"),
	tablesMissingHeaders: integer("tables_missing_headers").default(0),

	crossReferenceCount: integer("cross_reference_count"),
	brokenCrossReferences: integer("broken_cross_references").default(0),

	validationDurationMs: integer("validation_duration_ms"),
	validatorVersion: varchar("validator_version", { length: 50 }),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const tocEntries = pgTable("toc_entries", {
	id: uuid("id").primaryKey().defaultRandom(),

	documentId: uuid("document_id").notNull(),
	formatValidationId: uuid("format_validation_id").references(() => formatValidations.id, {
		onDelete: "set null",
	}),

	entryType: varchar("entry_type", { length: 50 }).notNull().$type<TocEntryType>(),
	title: varchar("title", { length: 500 }).notNull(),
	shortTitle: varchar("short_title", { length: 200 }),

	pageNumber: integer("page_number"),
	endPageNumber: integer("end_page_number"),
	sectionNumber: varchar("section_number", { length: 50 }),

	level: integer("level").notNull().default(1),
	sortOrder: integer("sort_order").notNull().default(0),
	parentEntryId: uuid("parent_entry_id"),

	includeInMainToc: boolean("include_in_main_toc").default(true),
	isGenerated: boolean("is_generated").default(true),
	anchorId: varchar("anchor_id", { length: 200 }),
	elementId: uuid("element_id"),

	caption: text("caption"),
	figureTableNumber: varchar("figure_table_number", { length: 50 }),

	isActive: boolean("is_active").default(true),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const formatPresets = pgTable("format_presets", {
	id: uuid("id").primaryKey().defaultRandom(),

	userId: varchar("user_id", { length: 200 }).notNull(),
	organizationId: uuid("organization_id"),

	name: varchar("name", { length: 200 }).notNull(),
	description: text("description"),
	tags: jsonb("tags").$type<string[]>(),

	baseTemplateId: uuid("base_template_id").references(() => formatTemplates.id, {
		onDelete: "set null",
	}),

	customSettings: jsonb("custom_settings").$type<CustomFormatSettings>().notNull(),

	targetAgency: varchar("target_agency", { length: 200 }),
	contractType: varchar("contract_type", { length: 100 }),

	isShared: boolean("is_shared").default(false),
	sharedAt: timestamp("shared_at", { withTimezone: true }),
	sharedBy: varchar("shared_by", { length: 200 }),
	isPublic: boolean("is_public").default(false),

	useCount: integer("use_count").default(0),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

	isActive: boolean("is_active").default(true),
	isFavorite: boolean("is_favorite").default(false),

	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Formatting Relations
export const formatTemplatesRelations = relations(formatTemplates, ({ many, one }) => ({
	documentFormats: many(documentFormats),
	validations: many(formatValidations),
	presets: many(formatPresets),
	derivedFrom: one(formatTemplates, {
		fields: [formatTemplates.derivedFromId],
		references: [formatTemplates.id],
		relationName: "derived_templates",
	}),
	derivatives: many(formatTemplates, {
		relationName: "derived_templates",
	}),
}));

export const documentFormatsRelations = relations(documentFormats, ({ one, many }) => ({
	template: one(formatTemplates, {
		fields: [documentFormats.templateId],
		references: [formatTemplates.id],
	}),
	lastValidation: one(formatValidations, {
		fields: [documentFormats.lastValidationId],
		references: [formatValidations.id],
	}),
}));

export const formatValidationsRelations = relations(formatValidations, ({ one, many }) => ({
	template: one(formatTemplates, {
		fields: [formatValidations.templateId],
		references: [formatTemplates.id],
	}),
	tocEntries: many(tocEntries),
}));

export const tocEntriesRelations = relations(tocEntries, ({ one, many }) => ({
	parentEntry: one(tocEntries, {
		fields: [tocEntries.parentEntryId],
		references: [tocEntries.id],
		relationName: "toc_hierarchy",
	}),
	childEntries: many(tocEntries, {
		relationName: "toc_hierarchy",
	}),
	validation: one(formatValidations, {
		fields: [tocEntries.formatValidationId],
		references: [formatValidations.id],
	}),
}));

export const formatPresetsRelations = relations(formatPresets, ({ one }) => ({
	baseTemplate: one(formatTemplates, {
		fields: [formatPresets.baseTemplateId],
		references: [formatTemplates.id],
	}),
}));

// Formatting Type exports
export type FormatTemplate = typeof formatTemplates.$inferSelect;
export type NewFormatTemplate = typeof formatTemplates.$inferInsert;
export type DocumentFormat = typeof documentFormats.$inferSelect;
export type NewDocumentFormat = typeof documentFormats.$inferInsert;
export type FormatValidation = typeof formatValidations.$inferSelect;
export type NewFormatValidation = typeof formatValidations.$inferInsert;
export type TocEntry = typeof tocEntries.$inferSelect;
export type NewTocEntry = typeof tocEntries.$inferInsert;
export type FormatPreset = typeof formatPresets.$inferSelect;
export type NewFormatPreset = typeof formatPresets.$inferInsert;


// ============================================================================
// ============================================================================
//
//  SECTION: GRAPHICS (Proposal Graphics)
//
// ============================================================================
// ============================================================================

export const proposalGraphics = pgTable("proposal_graphics", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  documentId: uuid("document_id"),
  sectionId: uuid("section_id"),

  title: varchar("title", { length: 500 }).notNull(),
  figureNumber: varchar("figure_number", { length: 50 }),

  graphicType: varchar("graphic_type", { length: 100 }).notNull(),
  format: varchar("format", { length: 50 }),

  sourceData: jsonb("source_data"),
  diagramCode: text("diagram_code"),
  imageUrl: text("image_url"),

  caption: text("caption"),
  actionCaption: text("action_caption"),

  width: integer("width"),
  height: integer("height"),

  generatedBy: varchar("generated_by", { length: 50 }),
  generationPrompt: text("generation_prompt"),

  status: varchar("status", { length: 50 }).default("draft"),
  approvedBy: varchar("approved_by", { length: 200 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const graphicTemplates = pgTable("graphic_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  graphicType: varchar("graphic_type", { length: 100 }).notNull(),
  format: varchar("format", { length: 50 }).notNull(),

  templateCode: text("template_code").notNull(),
  placeholders: jsonb("placeholders").$type<{
    key: string;
    label: string;
    type: "text" | "list" | "number" | "date";
    required: boolean;
    defaultValue?: string;
  }[]>(),

  previewImageUrl: text("preview_image_url"),

  useCount: integer("use_count").default(0),
  isPublic: boolean("is_public").default(false),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const graphicReferences = pgTable("graphic_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphicId: uuid("graphic_id").references(() => proposalGraphics.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull(),
  sectionId: uuid("section_id"),

  pageNumber: integer("page_number"),
  referenceText: text("reference_text"),

  isValid: boolean("is_valid").default(true),
  validationNotes: text("validation_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const graphicFeedback = pgTable("graphic_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  graphicId: uuid("graphic_id").references(() => proposalGraphics.id, { onDelete: "cascade" }),

  feedbackType: varchar("feedback_type", { length: 50 }).notNull(),
  content: text("content").notNull(),

  aiGenerated: boolean("ai_generated").default(false),
  confidence: real("confidence"),

  status: varchar("status", { length: 50 }).default("pending"),
  resolvedBy: varchar("resolved_by", { length: 200 }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),

  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const graphicStyleGuides = pgTable("graphic_style_guides", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  name: varchar("name", { length: 200 }).notNull(),
  isDefault: boolean("is_default").default(false),

  primaryColor: varchar("primary_color", { length: 20 }),
  secondaryColor: varchar("secondary_color", { length: 20 }),
  accentColor: varchar("accent_color", { length: 20 }),
  textColor: varchar("text_color", { length: 20 }),
  backgroundColor: varchar("background_color", { length: 20 }),
  colorPalette: jsonb("color_palette").$type<string[]>(),

  fontFamily: varchar("font_family", { length: 100 }),
  titleFontSize: integer("title_font_size"),
  labelFontSize: integer("label_font_size"),

  borderRadius: integer("border_radius"),
  lineWidth: integer("line_width"),
  arrowStyle: varchar("arrow_style", { length: 50 }),

  mermaidTheme: text("mermaid_theme"),
  d2Theme: text("d2_theme"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Graphics Relations
export const proposalGraphicsRelations = relations(proposalGraphics, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [proposalGraphics.opportunityId],
    references: [opportunities.id],
  }),
  references: many(graphicReferences),
  feedback: many(graphicFeedback),
}));

export const graphicReferencesRelations = relations(graphicReferences, ({ one }) => ({
  graphic: one(proposalGraphics, {
    fields: [graphicReferences.graphicId],
    references: [proposalGraphics.id],
  }),
}));

export const graphicFeedbackRelations = relations(graphicFeedback, ({ one }) => ({
  graphic: one(proposalGraphics, {
    fields: [graphicFeedback.graphicId],
    references: [proposalGraphics.id],
  }),
}));

// Graphics Type exports
export type ProposalGraphic = typeof proposalGraphics.$inferSelect;
export type NewProposalGraphic = typeof proposalGraphics.$inferInsert;
export type GraphicTemplate = typeof graphicTemplates.$inferSelect;
export type NewGraphicTemplate = typeof graphicTemplates.$inferInsert;
export type GraphicReference = typeof graphicReferences.$inferSelect;
export type GraphicFeedback = typeof graphicFeedback.$inferSelect;
export type GraphicStyleGuide = typeof graphicStyleGuides.$inferSelect;


// ============================================================================
// ============================================================================
//
//  SECTION: BIBLIOGRAPHY (Bibliography & Citations)
//
// ============================================================================
// ============================================================================

export const bibliographyEntryTypes = [
	"article",
	"book",
	"booklet",
	"conference",
	"inbook",
	"incollection",
	"inproceedings",
	"manual",
	"mastersthesis",
	"misc",
	"phdthesis",
	"proceedings",
	"techreport",
	"unpublished",
] as const;

export type BibliographyEntryType = (typeof bibliographyEntryTypes)[number];

export const citationStyles = [
	"apa",
	"mla",
	"chicago",
	"ieee",
	"vancouver",
	"harvard",
] as const;

export type CitationStyleType = (typeof citationStyles)[number];

export const bibliographyEntries = pgTable(
	"bibliography_entries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id"),

		citeKey: varchar("cite_key", { length: 100 }).notNull(),
		entryType: varchar("entry_type", { length: 50 }).notNull().$type<BibliographyEntryType>(),
		title: text("title").notNull(),
		authors: jsonb("authors").$type<string[]>().notNull().default([]),
		editors: jsonb("editors").$type<string[]>(),

		journal: varchar("journal", { length: 500 }),
		booktitle: varchar("booktitle", { length: 500 }),
		publisher: varchar("publisher", { length: 500 }),
		year: integer("year").notNull(),
		month: varchar("month", { length: 20 }),
		volume: varchar("volume", { length: 50 }),
		number: varchar("number", { length: 50 }),
		pages: varchar("pages", { length: 50 }),
		edition: varchar("edition", { length: 50 }),
		series: varchar("series", { length: 200 }),
		chapter: varchar("chapter", { length: 100 }),

		doi: varchar("doi", { length: 200 }),
		isbn: varchar("isbn", { length: 50 }),
		issn: varchar("issn", { length: 50 }),
		url: text("url"),
		arxivId: varchar("arxiv_id", { length: 50 }),
		pmid: varchar("pmid", { length: 20 }),

		abstract: text("abstract"),
		keywords: jsonb("keywords").$type<string[]>(),
		note: text("note"),

		address: varchar("address", { length: 500 }),
		institution: varchar("institution", { length: 500 }),
		school: varchar("school", { length: 500 }),
		organization: varchar("organization", { length: 500 }),

		citationCount: integer("citation_count").notNull().default(0),
		lastCitedAt: timestamp("last_cited_at", { withTimezone: true }),

		aiSummary: text("ai_summary"),
		aiKeyTerms: jsonb("ai_key_terms").$type<string[]>(),
		relevanceScore: integer("relevance_score"),

		isPublic: boolean("is_public").notNull().default(true),
		createdBy: uuid("created_by"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("bib_entries_org_idx").on(table.organizationId),
		index("bib_entries_type_idx").on(table.entryType),
		index("bib_entries_year_idx").on(table.year),
		uniqueIndex("bib_entries_cite_key_org_idx").on(table.citeKey, table.organizationId),
	]
);

export const documentCitations = pgTable(
	"document_citations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		bibliographyEntryId: uuid("bibliography_entry_id")
			.notNull()
			.references(() => bibliographyEntries.id, { onDelete: "cascade" }),

		citationStyle: varchar("citation_style", { length: 20 }).$type<CitationStyleType>(),
		formattedCitation: text("formatted_citation"),
		inTextCitation: text("in_text_citation"),

		sectionId: varchar("section_id", { length: 100 }),
		pageNumber: integer("page_number"),

		citedAt: timestamp("cited_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("doc_citations_doc_idx").on(table.documentId),
		index("doc_citations_entry_idx").on(table.bibliographyEntryId),
	]
);

export const citationPreferences = pgTable(
	"citation_preferences",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
		userId: uuid("user_id"),
		organizationId: uuid("organization_id"),

		defaultStyle: varchar("default_style", { length: 20 })
			.notNull()
			.$type<CitationStyleType>()
			.default("apa"),
		includeUrl: boolean("include_url").notNull().default(true),
		includeDoi: boolean("include_doi").notNull().default(true),
		includeAccessDate: boolean("include_access_date").notNull().default(false),
		sortOrder: varchar("sort_order", { length: 20 }).notNull().default("author"),

		customSettings: jsonb("custom_settings").$type<Record<string, unknown>>(),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("cite_prefs_doc_idx").on(table.documentId),
		index("cite_prefs_user_idx").on(table.userId),
	]
);

// Bibliography Relations
export const bibliographyEntriesRelations = relations(bibliographyEntries, ({ many }) => ({
	citations: many(documentCitations),
}));

export const documentCitationsRelations = relations(documentCitations, ({ one }) => ({
	document: one(documents, {
		fields: [documentCitations.documentId],
		references: [documents.id],
	}),
	bibliographyEntry: one(bibliographyEntries, {
		fields: [documentCitations.bibliographyEntryId],
		references: [bibliographyEntries.id],
	}),
}));

// Bibliography Type exports
export type BibliographyEntryRow = typeof bibliographyEntries.$inferSelect;
export type NewBibliographyEntry = typeof bibliographyEntries.$inferInsert;
export type DocumentCitationRow = typeof documentCitations.$inferSelect;
export type NewDocumentCitation = typeof documentCitations.$inferInsert;
export type CitationPreferencesRow = typeof citationPreferences.$inferSelect;
export type NewCitationPreferences = typeof citationPreferences.$inferInsert;
