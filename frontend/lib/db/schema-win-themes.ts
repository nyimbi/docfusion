/**
 * Win Theme Orchestration Engine Database Schema - DocFusion
 *
 * Implements comprehensive win theme management for government proposals,
 * supporting theme tracking, injection point identification, coverage analysis,
 * and competitive ghost theme development.
 *
 * Key Features:
 * - Core win themes with classification and evaluation criteria mapping
 * - Theme occurrence tracking across document sections with strength analysis
 * - AI-suggested injection points for theme reinforcement
 * - Theme analysis snapshots with coverage and consistency metrics
 * - Competitor profiling for ghost theme opportunities
 *
 * Tables:
 * - winThemes: Core win themes with supporting evidence and ghost themes
 * - themeOccurrences: Where themes appear in documents with strength ratings
 * - themeInjectionPoints: AI-suggested locations for theme insertion
 * - themeAnalysisResults: Analysis snapshots with coverage and gap identification
 * - competitorProfiles: Competitor intelligence for ghost theme development
 */

import { relations } from "drizzle-orm";
import {
	boolean,
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
// WIN THEME TYPE ENUMERATIONS
// ============================================================================

/**
 * Classification of win themes by strategic purpose.
 * - value_prop: Core value proposition differentiating the offer
 * - differentiator: Unique capability or approach distinguishing from competitors
 * - proof_point: Evidence-based claim supported by past performance or data
 * - risk_mitigation: Theme addressing evaluator concerns or perceived risks
 * - customer_focus: Theme demonstrating understanding of customer needs
 * - innovation: Theme highlighting innovative approaches or solutions
 */
export type ThemeType =
	| "value_prop"
	| "differentiator"
	| "proof_point"
	| "risk_mitigation"
	| "customer_focus"
	| "innovation";

/**
 * Strength rating for theme occurrences in document.
 * - strong: Theme explicitly stated with full supporting context
 * - moderate: Theme present but could be strengthened
 * - weak: Theme implied but not clearly articulated
 * - implicit: Theme only indirectly suggested, needs reinforcement
 */
export type ThemeStrength = "strong" | "moderate" | "weak" | "implicit";

/**
 * Type of theme occurrence in the document.
 * - explicit: Direct statement of the theme
 * - rephrased: Theme restated in different words
 * - supporting: Evidence or data supporting the theme
 * - related: Tangentially related content that could reinforce theme
 */
export type OccurrenceType = "explicit" | "rephrased" | "supporting" | "related";

/**
 * Type of theme injection suggested.
 * - insert: Add new content containing the theme
 * - replace: Replace existing content with theme-enhanced version
 * - enhance: Add to existing content to strengthen theme presence
 */
export type InjectionType = "insert" | "replace" | "enhance";

/**
 * Status of theme injection suggestion.
 * - pending: Suggestion awaiting review
 * - accepted: Suggestion accepted as-is
 * - rejected: Suggestion declined
 * - modified: Suggestion accepted with modifications
 */
export type InjectionStatus = "pending" | "accepted" | "rejected" | "modified";

/**
 * Confidence level for competitor intelligence.
 * - high: Verified information from reliable sources
 * - medium: Reasonably confident based on multiple indicators
 * - low: Speculative based on limited information
 */
export type IntelligenceConfidence = "high" | "medium" | "low";

/**
 * Source type for competitor intelligence.
 * - bid_intel: Information from bid/proposal intelligence
 * - market_research: Industry and market research
 * - past_competition: Historical competitive encounters
 * - public_sources: Publicly available information
 * - customer_feedback: Information from customer interactions
 */
export type IntelligenceSourceType =
	| "bid_intel"
	| "market_research"
	| "past_competition"
	| "public_sources"
	| "customer_feedback";

/**
 * Severity of theme coverage gaps.
 * - critical: Major gap that could significantly impact evaluation
 * - major: Important gap that should be addressed
 * - minor: Small gap with limited impact
 * - suggestion: Optional improvement opportunity
 */
export type GapSeverity = "critical" | "major" | "minor" | "suggestion";

/**
 * Type of recommendation from theme analysis.
 * - add_theme: Add a new theme to address gap
 * - strengthen_theme: Strengthen existing theme presence
 * - add_occurrence: Add theme occurrence in specific location
 * - remove_redundancy: Remove redundant theme occurrences
 * - rebalance_distribution: Adjust theme distribution across volumes
 * - ghost_opportunity: Opportunity for ghost theme against competitor
 */
export type RecommendationType =
	| "add_theme"
	| "strengthen_theme"
	| "add_occurrence"
	| "remove_redundancy"
	| "rebalance_distribution"
	| "ghost_opportunity";

// ============================================================================
// JSONB TYPE INTERFACES
// ============================================================================

/**
 * Theme coverage by volume breakdown.
 * Tracks how well themes are represented in each proposal volume.
 */
export interface VolumeCoverage {
	/** Volume identifier (e.g., "Technical Volume", "Management Approach") */
	volume: string;
	/** Coverage percentage (0-100) for this volume */
	coverage: number;
	/** Number of theme occurrences in this volume */
	themeCount: number;
}

/**
 * Theme distribution statistics across the proposal.
 */
export interface ThemeDistribution {
	/** Theme identifier */
	themeId: string;
	/** Number of times theme appears in the document */
	occurrenceCount: number;
	/** Average strength rating across occurrences (0-1 scale) */
	avgStrength: number;
	/** Percentage of target sections covered by this theme */
	coverage: number;
}

/**
 * Identified gap in theme coverage.
 */
export interface ThemeGap {
	/** Section identifier */
	sectionId: string;
	/** Section name for display */
	sectionName: string;
	/** Theme IDs that should be present but are missing */
	missingThemes: string[];
	/** Severity of the gap */
	severity: GapSeverity;
}

/**
 * Recommendation from theme analysis.
 */
export interface ThemeRecommendation {
	/** Type of recommendation */
	type: RecommendationType;
	/** Priority level (high, medium, low) */
	priority: string;
	/** Human-readable description */
	description: string;
	/** Theme ID this recommendation affects (if applicable) */
	affectedThemeId?: string;
	/** Section ID this recommendation targets (if applicable) */
	targetSectionId?: string;
}

/**
 * Ghost theme opportunity against a competitor.
 */
export interface GhostThemeOpportunity {
	/** Competitor weakness being exploited */
	weakness: string;
	/** Our corresponding strength */
	ourStrength: string;
	/** Suggested ghost theme language */
	suggestedTheme: string;
}

// ============================================================================
// WIN THEMES TABLE
// ============================================================================

/**
 * Core win themes for proposals.
 * Each theme represents a key message to be reinforced throughout the proposal,
 * mapped to evaluation criteria and supported by evidence.
 */
export const winThemes = pgTable("win_themes", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Opportunity association
	/** ID of the opportunity this theme belongs to */
	opportunityId: uuid("opportunity_id").notNull(),

	// Theme content
	/** Full theme statement - the core message to convey */
	themeStatement: text("theme_statement").notNull(),
	/** Short version for headers, callouts, and quick reference (max 200 chars) */
	shortVersion: varchar("short_version", { length: 200 }),

	// Classification
	/** Type of theme for categorization and analysis */
	themeType: varchar("theme_type", { length: 100 }).$type<ThemeType>(),
	/** Priority ranking for theme emphasis (1 = highest priority) */
	priority: integer("priority").default(1),

	// Supporting elements
	/** Array of supporting evidence statements */
	supportingEvidence: jsonb("supporting_evidence").$type<string[]>(),
	/** IDs of related past performance projects */
	relatedProjects: jsonb("related_projects").$type<string[]>(),

	// Evaluation mapping
	/** Evaluation criteria IDs this theme addresses */
	evaluationCriteriaIds: jsonb("evaluation_criteria_ids").$type<string[]>(),

	// Ghost themes (against competitors)
	/** Ghost theme statement targeting competitor weakness */
	ghostTheme: text("ghost_theme"),
	/** Name of competitor this ghost theme targets */
	targetCompetitor: varchar("target_competitor", { length: 200 }),

	// Keywords and variations
	/** Keywords associated with this theme for detection */
	keywords: jsonb("keywords").$type<string[]>(),
	/** Alternate phrasings of the theme */
	variations: jsonb("variations").$type<string[]>(),

	// Target coverage
	/** Target sections where this theme should appear */
	targetSections: jsonb("target_sections").$type<string[]>(),
	/** Minimum number of occurrences across document */
	minOccurrences: integer("min_occurrences").default(3),

	// Status
	/** Whether this theme is active for the current proposal version */
	isActive: boolean("is_active").default(true),

	// Audit fields
	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// THEME OCCURRENCES TABLE
// ============================================================================

/**
 * Tracks where themes appear in documents.
 * Supports both AI-detected and manually verified occurrences,
 * with strength ratings and classification.
 */
export const themeOccurrences = pgTable("theme_occurrences", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Theme association
	/** ID of the win theme this occurrence represents */
	themeId: uuid("theme_id")
		.references(() => winThemes.id, { onDelete: "cascade" })
		.notNull(),

	// Location in document
	/** ID of the document containing this occurrence */
	documentId: uuid("document_id").notNull(),
	/** ID of the section within the document */
	sectionId: uuid("section_id"),
	/** Human-readable section name */
	sectionName: varchar("section_name", { length: 300 }),
	/** Page number where occurrence appears */
	pageNumber: integer("page_number"),
	/** Paragraph index within the section (0-based) */
	paragraphIndex: integer("paragraph_index"),

	// Occurrence details
	/** Excerpt of text containing the theme */
	textExcerpt: text("text_excerpt"),
	/** Strength rating of this occurrence */
	strength: varchar("strength", { length: 50 }).$type<ThemeStrength>(),
	/** Type of occurrence */
	occurrenceType: varchar("occurrence_type", { length: 50 }).$type<OccurrenceType>(),

	// AI detection metadata
	/** When the AI detected this occurrence */
	detectedAt: timestamp("detected_at", { withTimezone: true }),
	/** AI confidence score (0-1) */
	confidence: real("confidence"),
	/** Whether this was suggested by AI */
	aiSuggested: boolean("ai_suggested").default(false),
	/** Whether a human has verified this occurrence */
	userVerified: boolean("user_verified").default(false),
	/** User who verified this occurrence */
	verifiedBy: varchar("verified_by", { length: 200 }),
	/** When the verification occurred */
	verifiedAt: timestamp("verified_at", { withTimezone: true }),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// THEME INJECTION POINTS TABLE
// ============================================================================

/**
 * AI-suggested locations for adding or strengthening themes.
 * Provides actionable recommendations with suggested text and rationale.
 */
export const themeInjectionPoints = pgTable("theme_injection_points", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Theme association
	/** ID of the win theme to inject */
	themeId: uuid("theme_id")
		.references(() => winThemes.id, { onDelete: "cascade" })
		.notNull(),

	// Target location
	/** ID of the target document */
	documentId: uuid("document_id").notNull(),
	/** ID of the target section */
	sectionId: uuid("section_id"),
	/** Human-readable section name */
	sectionName: varchar("section_name", { length: 300 }),
	/** Page number for the injection point */
	pageNumber: integer("page_number"),
	/** Surrounding text for context */
	textContext: text("text_context"),

	// Suggestion details
	/** Suggested text to inject */
	suggestedText: text("suggested_text").notNull(),
	/** Type of injection (insert, replace, enhance) */
	injectionType: varchar("injection_type", { length: 50 }).$type<InjectionType>(),
	/** AI rationale for this suggestion */
	rationale: text("rationale"),

	// Priority scoring
	/** Expected improvement score from implementing (0-1) */
	impactScore: real("impact_score"),
	/** Relevance to the target section (0-1) */
	relevanceScore: real("relevance_score"),
	/** Combined priority score */
	priorityScore: real("priority_score"),

	// Status workflow
	/** Current status of the suggestion */
	status: varchar("status", { length: 50 }).default("pending").$type<InjectionStatus>(),
	/** Modified text if user changed the suggestion */
	acceptedText: text("accepted_text"),
	/** User who acted on this suggestion */
	acceptedBy: varchar("accepted_by", { length: 200 }),
	/** When the action was taken */
	acceptedAt: timestamp("accepted_at", { withTimezone: true }),
	/** Notes from reviewer */
	reviewNotes: text("review_notes"),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// THEME ANALYSIS RESULTS TABLE
// ============================================================================

/**
 * Snapshot of theme analysis for a proposal.
 * Captures coverage metrics, distribution analysis, gaps, and recommendations
 * at a point in time for tracking improvement.
 */
export const themeAnalysisResults = pgTable("theme_analysis_results", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Opportunity association
	/** ID of the opportunity being analyzed */
	opportunityId: uuid("opportunity_id").notNull(),

	// Analysis metadata
	/** When the analysis was performed */
	analyzedAt: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
	/** User or system that triggered the analysis */
	analyzedBy: varchar("analyzed_by", { length: 200 }),
	/** Document version ID analyzed (snapshot reference) */
	documentVersionId: uuid("document_version_id"),
	/** Analysis run identifier for grouping related analyses */
	analysisRunId: uuid("analysis_run_id"),

	// Summary metrics
	/** Total number of active themes */
	totalThemes: integer("total_themes"),
	/** Average coverage percentage across all themes */
	averageCoverage: real("average_coverage"),
	/** Overall consistency score (0-100) measuring theme application uniformity */
	consistencyScore: real("consistency_score"),
	/** Win probability impact score */
	winProbabilityImpact: real("win_probability_impact"),

	// Coverage breakdown
	/** Coverage analysis by volume/section */
	coverageByVolume: jsonb("coverage_by_volume").$type<VolumeCoverage[]>(),
	/** Distribution of each theme across the document */
	themeDistribution: jsonb("theme_distribution").$type<ThemeDistribution[]>(),

	// Gap analysis
	/** Identified gaps where themes are missing or weak */
	gaps: jsonb("gaps").$type<ThemeGap[]>(),
	/** Count of critical gaps */
	criticalGapCount: integer("critical_gap_count").default(0),
	/** Count of major gaps */
	majorGapCount: integer("major_gap_count").default(0),
	/** Count of minor gaps */
	minorGapCount: integer("minor_gap_count").default(0),

	// Recommendations
	/** Generated recommendations for improvement */
	recommendations: jsonb("recommendations").$type<ThemeRecommendation[]>(),
	/** Count of high priority recommendations */
	highPriorityRecommendations: integer("high_priority_recommendations").default(0),

	// Trend tracking
	/** Previous analysis ID for comparison */
	previousAnalysisId: uuid("previous_analysis_id"),
	/** Coverage change from previous analysis */
	coverageChange: real("coverage_change"),
	/** Consistency change from previous analysis */
	consistencyChange: real("consistency_change"),

	// Processing metrics
	/** Time taken to perform analysis (milliseconds) */
	analysisDurationMs: integer("analysis_duration_ms"),

	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// COMPETITOR PROFILES TABLE
// ============================================================================

/**
 * Competitor intelligence profiles for ghost theme development.
 * Captures known strengths, weaknesses, and opportunities for positioning.
 */
export const competitorProfiles = pgTable("competitor_profiles", {
	id: uuid("id").primaryKey().defaultRandom(),

	// Opportunity association
	/** ID of the opportunity this profile relates to */
	opportunityId: uuid("opportunity_id").notNull(),

	// Competitor identification
	/** Name of the competitor */
	competitorName: varchar("competitor_name", { length: 200 }).notNull(),
	/** Brief description of the competitor */
	competitorDescription: text("competitor_description"),

	// Intelligence data
	/** Known competitor strengths */
	competitorStrengths: jsonb("competitor_strengths").$type<string[]>(),
	/** Known competitor weaknesses */
	competitorWeaknesses: jsonb("competitor_weaknesses").$type<string[]>(),
	/** Competitor's likely key messages/themes */
	competitorThemes: jsonb("competitor_themes").$type<string[]>(),

	// Our positioning
	/** Our differentiators against this competitor */
	ourDifferentiators: jsonb("our_differentiators").$type<string[]>(),
	/** Identified ghost theme opportunities */
	ghostThemeOpportunities: jsonb("ghost_theme_opportunities").$type<GhostThemeOpportunity[]>(),

	// Intelligence source and confidence
	/** Primary source type for this intelligence */
	sourceType: varchar("source_type", { length: 100 }).$type<IntelligenceSourceType>(),
	/** Confidence level in the intelligence */
	confidenceLevel: varchar("confidence_level", { length: 50 }).$type<IntelligenceConfidence>(),
	/** Additional source notes */
	sourceNotes: text("source_notes"),
	/** Date of last intelligence update */
	intelligenceDate: timestamp("intelligence_date", { withTimezone: true }),

	// Bid intelligence
	/** Estimated competitor bid price range */
	estimatedPriceRange: jsonb("estimated_price_range").$type<{ min?: number; max?: number }>(),
	/** Expected teaming arrangements */
	expectedTeaming: jsonb("expected_teaming").$type<string[]>(),
	/** Incumbent status */
	isIncumbent: boolean("is_incumbent").default(false),

	// Status
	/** Whether this profile is active */
	isActive: boolean("is_active").default(true),

	// Audit fields
	createdBy: varchar("created_by", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

/**
 * Relations for winThemes table.
 */
export const winThemesRelations = relations(winThemes, ({ many }) => ({
	/** Occurrences of this theme in documents */
	occurrences: many(themeOccurrences),
	/** Suggested injection points for this theme */
	injectionPoints: many(themeInjectionPoints),
}));

/**
 * Relations for themeOccurrences table.
 */
export const themeOccurrencesRelations = relations(themeOccurrences, ({ one }) => ({
	/** Parent win theme */
	theme: one(winThemes, {
		fields: [themeOccurrences.themeId],
		references: [winThemes.id],
	}),
}));

/**
 * Relations for themeInjectionPoints table.
 */
export const themeInjectionPointsRelations = relations(themeInjectionPoints, ({ one }) => ({
	/** Theme to be injected */
	theme: one(winThemes, {
		fields: [themeInjectionPoints.themeId],
		references: [winThemes.id],
	}),
}));

/**
 * Relations for themeAnalysisResults table.
 */
export const themeAnalysisResultsRelations = relations(themeAnalysisResults, ({ one }) => ({
	/** Previous analysis for trend comparison */
	previousAnalysis: one(themeAnalysisResults, {
		fields: [themeAnalysisResults.previousAnalysisId],
		references: [themeAnalysisResults.id],
		relationName: "analysis_history",
	}),
}));

/**
 * Relations for competitorProfiles table.
 * Note: No direct foreign keys, but logically related to opportunities.
 */
export const competitorProfilesRelations = relations(competitorProfiles, ({}) => ({}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/** Win theme select type */
export type WinTheme = typeof winThemes.$inferSelect;
/** Win theme insert type */
export type NewWinTheme = typeof winThemes.$inferInsert;

/** Theme occurrence select type */
export type ThemeOccurrence = typeof themeOccurrences.$inferSelect;
/** Theme occurrence insert type */
export type NewThemeOccurrence = typeof themeOccurrences.$inferInsert;

/** Theme injection point select type */
export type ThemeInjectionPoint = typeof themeInjectionPoints.$inferSelect;
/** Theme injection point insert type */
export type NewThemeInjectionPoint = typeof themeInjectionPoints.$inferInsert;

/** Theme analysis result select type */
export type ThemeAnalysisResult = typeof themeAnalysisResults.$inferSelect;
/** Theme analysis result insert type */
export type NewThemeAnalysisResult = typeof themeAnalysisResults.$inferInsert;

/** Competitor profile select type */
export type CompetitorProfile = typeof competitorProfiles.$inferSelect;
/** Competitor profile insert type */
export type NewCompetitorProfile = typeof competitorProfiles.$inferInsert;
