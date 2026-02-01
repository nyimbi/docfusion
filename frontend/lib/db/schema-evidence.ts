/**
 * Evidence & Proof Point Optimizer Database Schema - DocFusion
 *
 * Implements comprehensive evidence management for government proposals,
 * supporting proof point repositories, claim analysis, evidence matrices,
 * and strength evaluation for proposal evaluation optimization.
 *
 * Key Features:
 * - Central evidence library with quantification and source tracking
 * - Evidence usage tracking across documents and opportunities
 * - Automated claim analysis identifying unsupported assertions
 * - Evidence coverage matrices mapping proof points to evaluation criteria
 * - Multi-dimensional evidence strength analysis
 *
 * Tables:
 * - evidenceLibrary: Repository of proof points, metrics, and testimonials
 * - evidenceUsages: Track where and how evidence is used in proposals
 * - claimAnalysis: Identify and resolve unsupported claims in documents
 * - evidenceMatrices: Coverage matrices mapping evidence to requirements
 * - evidenceStrengthAnalysis: Detailed strength evaluation by dimension
 *
 * Proposal Evaluation Context:
 * Government proposal evaluators assess technical merit based on verifiable
 * evidence. Strong proposals substantiate every claim with quantified metrics,
 * customer testimonials, and documented past performance. This schema enables
 * systematic evidence management ensuring no claim goes unsubstantiated.
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
// EVIDENCE TYPE ENUMERATIONS
// ============================================================================

/**
 * Classification of evidence by type.
 * - metric: Quantified performance data (e.g., "99.9% uptime")
 * - testimonial: Customer or stakeholder endorsement
 * - case_study: Detailed project narrative with outcomes
 * - certification: Industry or government certification (e.g., ISO, FedRAMP)
 * - award: Recognition or award received
 * - publication: Published research, papers, or documentation
 * - capability: Documented capability or resource
 */
export type EvidenceType =
	| "metric"
	| "testimonial"
	| "case_study"
	| "certification"
	| "award"
	| "publication"
	| "capability";

/**
 * Category of evidence by proposal section relevance.
 * - technical: Technical approach and methodology evidence
 * - management: Management and staffing evidence
 * - past_performance: Historical project performance evidence
 * - cost_efficiency: Cost savings and efficiency evidence
 * - innovation: Innovation and improvement evidence
 */
export type EvidenceCategory =
	| "technical"
	| "management"
	| "past_performance"
	| "cost_efficiency"
	| "innovation";

/**
 * Source type for evidence provenance.
 * - internal: Company-generated data or documentation
 * - customer: Customer-provided feedback or testimonials
 * - third_party: Independent third-party verification
 * - government: Government agency data or evaluations
 */
export type EvidenceSourceType =
	| "internal"
	| "customer"
	| "third_party"
	| "government";

/**
 * Status of evidence in the library.
 * - draft: Evidence being developed, not yet approved for use
 * - approved: Verified and approved for proposal use
 * - archived: No longer actively used but retained for history
 */
export type EvidenceStatus = "draft" | "approved" | "archived";

/**
 * Type of evidence usage in documents.
 * - direct_quote: Exact quote of evidence content
 * - paraphrased: Restated in proposal-specific language
 * - supporting: Used as supporting context for a claim
 * - reference: Referenced without full inclusion
 */
export type EvidenceUsageType =
	| "direct_quote"
	| "paraphrased"
	| "supporting"
	| "reference";

/**
 * Effectiveness rating for evidence usage.
 * - strong: Evidence directly addresses evaluation criteria
 * - moderate: Evidence partially addresses criteria
 * - weak: Evidence tangentially related to criteria
 */
export type EvidenceEffectiveness = "strong" | "moderate" | "weak";

/**
 * Type of claim identified in documents.
 * - capability: Statement about organizational capability
 * - performance: Statement about performance levels
 * - experience: Statement about relevant experience
 * - commitment: Promise about future actions
 * - promise: Guarantee or assurance statement
 */
export type ClaimType =
	| "capability"
	| "performance"
	| "experience"
	| "commitment"
	| "promise";

/**
 * Strength of evidence supporting a claim.
 * - none: No supporting evidence found
 * - weak: Minimal or tangential evidence
 * - moderate: Reasonable supporting evidence
 * - strong: Comprehensive, quantified evidence
 */
export type ClaimEvidenceStrength = "none" | "weak" | "moderate" | "strong";

/**
 * Risk level of unsupported claims.
 * - high: Claim likely to be challenged by evaluators
 * - medium: Claim may raise evaluator concerns
 * - low: Claim acceptable without extensive support
 */
export type ClaimRiskLevel = "high" | "medium" | "low";

/**
 * Status of claim analysis resolution.
 * - open: Claim requires attention
 * - in_progress: Being addressed by author
 * - resolved: Evidence added or claim modified
 * - wont_fix: Accepted risk, no action taken
 */
export type ClaimAnalysisStatus =
	| "open"
	| "in_progress"
	| "resolved"
	| "wont_fix";

/**
 * Resolution approach for claim analysis.
 * - evidence_added: Supporting evidence was added
 * - claim_removed: Unsupported claim was removed
 * - claim_modified: Claim was weakened or qualified
 * - accepted_as_is: Risk accepted, claim unchanged
 */
export type ClaimResolution =
	| "evidence_added"
	| "claim_removed"
	| "claim_modified"
	| "accepted_as_is";

/**
 * Type of evidence matrix for different use cases.
 * - evaluation_criteria: Matrix mapping evidence to RFP evaluation criteria
 * - requirements: Matrix mapping evidence to technical requirements
 * - sections: Matrix mapping evidence to proposal sections
 */
export type EvidenceMatrixType =
	| "evaluation_criteria"
	| "requirements"
	| "sections";

/**
 * Criticality level for evidence gaps.
 * - critical: Gap in mandatory/heavily-weighted requirement
 * - major: Gap in important requirement area
 * - minor: Gap in lower-priority requirement
 * - optional: Gap in optional enhancement area
 */
export type GapCriticality = "critical" | "major" | "minor" | "optional";

/**
 * Tier classification for evidence strength.
 * - gold: Top-tier evidence meeting all strength criteria
 * - silver: Strong evidence meeting most criteria
 * - bronze: Acceptable evidence meeting minimum criteria
 */
export type EvidenceTier = "gold" | "silver" | "bronze";

// ============================================================================
// JSONB TYPE INTERFACES
// ============================================================================

/**
 * Individual factor contributing to evidence strength score.
 */
export interface StrengthFactor {
	/** Name of the strength factor (e.g., "Quantification", "Recency") */
	factor: string;
	/** Score for this factor (0-100) */
	score: number;
	/** Optional notes explaining the score */
	notes?: string;
}

/**
 * Location reference within a document for claim identification.
 */
export interface ClaimLocation {
	/** Page number where claim appears (if applicable) */
	pageNumber?: number;
	/** Paragraph index within section (0-based) */
	paragraphIndex?: number;
	/** Character offset for start of claim */
	charStart?: number;
	/** Character offset for end of claim */
	charEnd?: number;
}

/**
 * Suggested evidence for supporting an unsupported claim.
 */
export interface SuggestedEvidence {
	/** ID of the suggested evidence from library */
	evidenceId: string;
	/** Relevance score (0-1) to the claim */
	relevance: number;
	/** Explanation of why this evidence is relevant */
	reason: string;
}

/**
 * Row definition in an evidence matrix.
 */
export interface EvidenceMatrixRow {
	/** Unique identifier for the row */
	id: string;
	/** Display name (e.g., evaluation criterion name) */
	name: string;
	/** Optional weight/importance (0-100) */
	weight?: number;
}

/**
 * Column definition in an evidence matrix.
 */
export interface EvidenceMatrixColumn {
	/** Unique identifier for the column */
	id: string;
	/** Display name (e.g., evidence category) */
	name: string;
}

/**
 * Cell data in an evidence matrix.
 */
export interface EvidenceMatrixCell {
	/** Row identifier this cell belongs to */
	rowId: string;
	/** Column identifier this cell belongs to */
	colId: string;
	/** IDs of evidence items in this cell */
	evidenceIds: string[];
	/** Coverage score (0-100) for this intersection */
	coverageScore: number;
	/** Optional notes about coverage */
	notes?: string;
}

/**
 * Gap identified in evidence matrix analysis.
 */
export interface EvidenceMatrixGap {
	/** Row identifier with the gap */
	rowId: string;
	/** Row name for display */
	rowName: string;
	/** Categories/columns with missing evidence */
	missingCategories: string[];
	/** Criticality level of this gap */
	criticality: GapCriticality;
}

/**
 * Improvement suggestion for evidence strength.
 */
export interface StrengthImprovementSuggestion {
	/** Dimension that could be improved */
	dimension: string;
	/** Current score for the dimension */
	current: number;
	/** Potential score if improved */
	potential: number;
	/** Specific suggestion for improvement */
	suggestion: string;
}

// ============================================================================
// EVIDENCE LIBRARY TABLE
// ============================================================================

/**
 * Central repository of proof points and evidence.
 * Stores quantified metrics, testimonials, certifications, and other
 * supporting evidence that can be used across multiple proposals.
 * Evidence is classified, strength-rated, and tagged for easy retrieval.
 */
export const evidenceLibrary = pgTable("evidence_library", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Organization that owns this evidence */
	organizationId: uuid("organization_id").notNull(),

	// Evidence content
	/** Title/headline for the evidence item */
	title: varchar("title", { length: 500 }).notNull(),
	/** Full evidence content/description */
	content: text("content").notNull(),
	/** AI-generated summary for quick reference */
	summary: text("summary"),

	// Classification
	/** Type of evidence (metric, testimonial, case_study, etc.) */
	evidenceType: varchar("evidence_type", { length: 100 }).$type<EvidenceType>(),
	/** Primary category (technical, management, past_performance, etc.) */
	category: varchar("category", { length: 100 }).$type<EvidenceCategory>(),
	/** More specific subcategory within the main category */
	subcategory: varchar("subcategory", { length: 200 }),
	/** Tags for flexible categorization and search */
	tags: jsonb("tags").$type<string[]>(),

	// Quantification (critical for proposal strength)
	/** Whether this evidence includes quantified data */
	isQuantified: boolean("is_quantified").default(false),
	/** Name of the metric (e.g., "cost savings", "uptime", "satisfaction") */
	metric: varchar("metric", { length: 200 }),
	/** Value of the metric (e.g., "25", "99.9", "4.8") */
	metricValue: varchar("metric_value", { length: 100 }),
	/** Unit of measurement (e.g., "%", "days", "rating") */
	metricUnit: varchar("metric_unit", { length: 50 }),
	/** Context for the metric (baseline, comparison period, methodology) */
	metricContext: text("metric_context"),

	// Source and verification
	/** Type of source for provenance */
	sourceType: varchar("source_type", { length: 100 }).$type<EvidenceSourceType>(),
	/** Detailed source reference (document, person, URL) */
	sourceReference: text("source_reference"),
	/** Date the evidence was created or last verified */
	sourceDate: date("source_date"),
	/** Whether the evidence has been independently verified */
	sourceVerified: boolean("source_verified").default(false),
	/** Notes from verification process */
	verificationNotes: text("verification_notes"),

	// Strength rating
	/** Overall strength score (0-100) based on multiple factors */
	strengthScore: real("strength_score"),
	/** Breakdown of factors contributing to strength score */
	strengthFactors: jsonb("strength_factors").$type<StrengthFactor[]>(),

	// Relevance tagging for retrieval
	/** Capabilities this evidence supports */
	relatedCapabilities: jsonb("related_capabilities").$type<string[]>(),
	/** NAICS codes this evidence is relevant to */
	relatedNaicsCodes: jsonb("related_naics_codes").$type<string[]>(),
	/** Federal agencies this evidence is relevant to */
	relatedAgencies: jsonb("related_agencies").$type<string[]>(),

	// Usage tracking
	/** Number of times this evidence has been used in proposals */
	useCount: integer("use_count").default(0),
	/** Timestamp of most recent usage */
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	/** ID of opportunity where evidence was last used */
	lastUsedInOpportunityId: uuid("last_used_in_opportunity_id"),

	// Status and approval workflow
	/** Current status of evidence item */
	status: varchar("status", { length: 50 }).default("draft").$type<EvidenceStatus>(),
	/** User who approved this evidence for use */
	approvedBy: varchar("approved_by", { length: 200 }),
	/** When the evidence was approved */
	approvedAt: timestamp("approved_at", { withTimezone: true }),

	// Audit fields
	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// EVIDENCE USAGES TABLE
// ============================================================================

/**
 * Tracks where and how evidence is used across proposals.
 * Enables impact analysis, usage optimization, and effectiveness tracking.
 * Links evidence library items to specific document sections and opportunities.
 */
export const evidenceUsages = pgTable("evidence_usages", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Reference to the evidence item being used */
	evidenceId: uuid("evidence_id")
		.references(() => evidenceLibrary.id, { onDelete: "cascade" })
		.notNull(),

	// Usage location
	/** Opportunity where evidence is used */
	opportunityId: uuid("opportunity_id"),
	/** Document containing the usage */
	documentId: uuid("document_id"),
	/** Section within the document */
	sectionId: uuid("section_id"),
	/** Human-readable section name */
	sectionName: varchar("section_name", { length: 300 }),

	// How the evidence is used
	/** Type of usage (direct quote, paraphrased, supporting, reference) */
	usageType: varchar("usage_type", { length: 50 }).$type<EvidenceUsageType>(),
	/** The actual text as used in the document */
	usedText: text("used_text"),
	/** Surrounding context in the document */
	context: text("context"),

	// Effectiveness assessment
	/** Effectiveness rating from evaluator perspective */
	effectiveness: varchar("effectiveness", { length: 50 }).$type<EvidenceEffectiveness>(),
	/** Feedback from proposal reviewers or evaluators */
	evaluatorFeedback: text("evaluator_feedback"),

	// Audit fields
	usedAt: timestamp("used_at", { withTimezone: true }).defaultNow(),
	usedBy: varchar("used_by", { length: 200 }),
});

// ============================================================================
// CLAIM ANALYSIS TABLE
// ============================================================================

/**
 * Identifies and tracks unsupported claims in proposal documents.
 * AI-powered analysis finds assertions lacking evidence and suggests
 * proof points from the evidence library to substantiate claims.
 * Critical for strengthening proposals before submission.
 */
export const claimAnalysis = pgTable("claim_analysis", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Document location
	/** Document containing the claim */
	documentId: uuid("document_id"),
	/** Section containing the claim */
	sectionId: uuid("section_id"),
	/** Opportunity context for relevance assessment */
	opportunityId: uuid("opportunity_id"),

	// Claim identification
	/** The exact claim text identified */
	claimText: text("claim_text").notNull(),
	/** Type of claim (capability, performance, experience, etc.) */
	claimType: varchar("claim_type", { length: 50 }).$type<ClaimType>(),
	/** Location coordinates within the document */
	claimLocation: jsonb("claim_location").$type<ClaimLocation>(),

	// Analysis results
	/** Whether supporting evidence was found */
	hasEvidence: boolean("has_evidence").default(false),
	/** Strength of available evidence */
	evidenceStrength: varchar("evidence_strength", { length: 50 }).$type<ClaimEvidenceStrength>(),
	/** IDs of evidence items linked to this claim */
	linkedEvidenceIds: jsonb("linked_evidence_ids").$type<string[]>(),

	// Suggestions for improvement
	/** AI-suggested evidence from library to support this claim */
	suggestedEvidence: jsonb("suggested_evidence").$type<SuggestedEvidence[]>(),
	/** Suggestion for quantifying the claim */
	quantificationSuggestion: text("quantification_suggestion"),

	// Risk assessment
	/** Risk level if claim remains unsupported */
	riskLevel: varchar("risk_level", { length: 50 }).$type<ClaimRiskLevel>(),
	/** Explanation of potential evaluator impact */
	evaluatorImpact: text("evaluator_impact"),

	// Resolution workflow
	/** Current status of this analysis */
	status: varchar("status", { length: 50 }).default("open").$type<ClaimAnalysisStatus>(),
	/** How the claim was resolved */
	resolution: varchar("resolution", { length: 50 }).$type<ClaimResolution>(),
	/** User who resolved this item */
	resolvedBy: varchar("resolved_by", { length: 200 }),
	/** When the resolution occurred */
	resolvedAt: timestamp("resolved_at", { withTimezone: true }),
	/** Notes explaining the resolution approach */
	resolutionNotes: text("resolution_notes"),

	// Audit fields
	analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// EVIDENCE MATRICES TABLE
// ============================================================================

/**
 * Evidence coverage matrices mapping proof points to evaluation criteria.
 * Provides visual representation of evidence coverage against requirements,
 * identifying gaps and ensuring comprehensive substantiation of claims.
 * Essential for compliance matrix development and proposal review.
 */
export const evidenceMatrices = pgTable("evidence_matrices", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Opportunity this matrix was created for */
	opportunityId: uuid("opportunity_id"),

	// Matrix metadata
	/** Name/title of the matrix */
	name: varchar("name", { length: 300 }),
	/** Type of matrix (evaluation_criteria, requirements, sections) */
	matrixType: varchar("matrix_type", { length: 50 }).$type<EvidenceMatrixType>(),

	// Matrix structure
	/** Row definitions (e.g., evaluation criteria, requirements) */
	rows: jsonb("rows").$type<EvidenceMatrixRow[]>(),
	/** Column definitions (e.g., evidence categories) */
	columns: jsonb("columns").$type<EvidenceMatrixColumn[]>(),
	/** Cell data mapping evidence to row/column intersections */
	cells: jsonb("cells").$type<EvidenceMatrixCell[]>(),

	// Analysis results
	/** Overall coverage percentage across the matrix */
	overallCoverage: real("overall_coverage"),
	/** Identified gaps in evidence coverage */
	gapAnalysis: jsonb("gap_analysis").$type<EvidenceMatrixGap[]>(),

	// Audit fields
	generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
	generatedBy: varchar("generated_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// EVIDENCE STRENGTH ANALYSIS TABLE
// ============================================================================

/**
 * Detailed multi-dimensional strength evaluation for evidence items.
 * Analyzes evidence across key dimensions (recency, specificity, quantification,
 * verifiability, relevance) to provide actionable improvement recommendations.
 * Supports evidence quality improvement initiatives.
 */
export const evidenceStrengthAnalysis = pgTable("evidence_strength_analysis", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** Evidence item being analyzed */
	evidenceId: uuid("evidence_id")
		.references(() => evidenceLibrary.id, { onDelete: "cascade" })
		.notNull(),

	// Analysis dimensions (each scored 0-100)
	/** Score for evidence recency - how recent is the data/example */
	recencyScore: real("recency_score"),
	/** Score for specificity - how specific vs generic is the evidence */
	specificityScore: real("specificity_score"),
	/** Score for quantification - degree of measurable data included */
	quantificationScore: real("quantification_score"),
	/** Score for verifiability - can evaluators verify the claims */
	verifiabilityScore: real("verifiability_score"),
	/** Score for typical relevance - applicability to common requirements */
	relevanceScore: real("relevance_score"),

	// Composite assessment
	/** Weighted composite score across all dimensions */
	compositeScore: real("composite_score"),
	/** Tier classification based on composite score */
	tier: varchar("tier", { length: 50 }).$type<EvidenceTier>(),

	// Improvement recommendations
	/** Actionable suggestions for strengthening this evidence */
	improvementSuggestions: jsonb("improvement_suggestions").$type<StrengthImprovementSuggestion[]>(),

	// Audit fields
	analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

/**
 * Relations for evidenceLibrary table.
 * Evidence can be used multiple times across proposals and
 * can have detailed strength analysis performed.
 */
export const evidenceLibraryRelations = relations(evidenceLibrary, ({ many }) => ({
	/** Usages of this evidence across proposals */
	usages: many(evidenceUsages),
	/** Strength analysis records for this evidence */
	strengthAnalyses: many(evidenceStrengthAnalysis),
}));

/**
 * Relations for evidenceUsages table.
 * Each usage links back to a single evidence item.
 */
export const evidenceUsagesRelations = relations(evidenceUsages, ({ one }) => ({
	/** Parent evidence item */
	evidence: one(evidenceLibrary, {
		fields: [evidenceUsages.evidenceId],
		references: [evidenceLibrary.id],
	}),
}));

/**
 * Relations for claimAnalysis table.
 * Claims are independent entities with JSON references to evidence,
 * supporting flexible many-to-many relationships without join tables.
 */
export const claimAnalysisRelations = relations(claimAnalysis, ({}) => ({}));

/**
 * Relations for evidenceMatrices table.
 * Matrices contain embedded evidence references in JSONB cells,
 * no direct foreign key relationships needed.
 */
export const evidenceMatricesRelations = relations(evidenceMatrices, ({}) => ({}));

/**
 * Relations for evidenceStrengthAnalysis table.
 * Each analysis links to exactly one evidence item.
 */
export const evidenceStrengthAnalysisRelations = relations(evidenceStrengthAnalysis, ({ one }) => ({
	/** Evidence item being analyzed */
	evidence: one(evidenceLibrary, {
		fields: [evidenceStrengthAnalysis.evidenceId],
		references: [evidenceLibrary.id],
	}),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/** Evidence library item select type */
export type Evidence = typeof evidenceLibrary.$inferSelect;
/** Evidence library item insert type */
export type NewEvidence = typeof evidenceLibrary.$inferInsert;

/** Evidence usage select type */
export type EvidenceUsage = typeof evidenceUsages.$inferSelect;
/** Evidence usage insert type */
export type NewEvidenceUsage = typeof evidenceUsages.$inferInsert;

/** Claim analysis select type */
export type ClaimAnalysisRecord = typeof claimAnalysis.$inferSelect;
/** Claim analysis insert type */
export type NewClaimAnalysis = typeof claimAnalysis.$inferInsert;

/** Evidence matrix select type */
export type EvidenceMatrix = typeof evidenceMatrices.$inferSelect;
/** Evidence matrix insert type */
export type NewEvidenceMatrix = typeof evidenceMatrices.$inferInsert;

/** Evidence strength analysis select type */
export type EvidenceStrengthAnalysisRecord = typeof evidenceStrengthAnalysis.$inferSelect;
/** Evidence strength analysis insert type */
export type NewEvidenceStrengthAnalysis = typeof evidenceStrengthAnalysis.$inferInsert;
