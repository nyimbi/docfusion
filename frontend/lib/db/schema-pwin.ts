import { pgTable, uuid, varchar, text, timestamp, real, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// PWin factors define the scoring criteria
export const pwinFactors = pgTable("pwin_factors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  // Factor definition
  factorName: varchar("factor_name", { length: 200 }).notNull(),
  factorCategory: varchar("factor_category", { length: 100 }).notNull(), // customer, solution, competition, team, price, contract
  description: text("description"),

  // Scoring parameters
  weight: real("weight").default(1),
  minScore: real("min_score").default(0),
  maxScore: real("max_score").default(10),

  // Correlation to outcomes (updated by model training)
  winCorrelation: real("win_correlation"),

  // Guidance
  scoringGuidelines: jsonb("scoring_guidelines").$type<{
    score: number;
    description: string;
  }[]>(),

  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// PWin assessments for opportunities
export const pwinAssessments = pgTable("pwin_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id"),
  organizationId: uuid("organization_id"),

  // Assessment timing
  assessedAt: timestamp("assessed_at", { withTimezone: true }).defaultNow(),
  assessedBy: varchar("assessed_by", { length: 200 }),
  assessmentType: varchar("assessment_type", { length: 50 }), // initial, mid-capture, final, gate_review

  // Factor scores
  factorScores: jsonb("factor_scores").$type<{
    factorId: string;
    factorName: string;
    score: number;
    weight: number;
    notes?: string;
  }[]>().default([]),

  // Calculated Pwin
  calculatedPwin: real("calculated_pwin"),
  previousPwin: real("previous_pwin"),
  pwinDelta: real("pwin_delta"),

  // Confidence interval
  confidenceInterval: jsonb("confidence_interval").$type<{
    lower: number;
    upper: number;
    confidence: number;
  }>(),

  // Sensitivity analysis
  sensitivityAnalysis: jsonb("sensitivity_analysis").$type<{
    factorId: string;
    factorName: string;
    currentScore: number;
    impactIfImproved: number;
    improvementPotential: number;
  }[]>(),

  // AI recommendations
  recommendations: jsonb("recommendations").$type<{
    recommendation: string;
    priority: "high" | "medium" | "low";
    factorId?: string;
    expectedImpact: number;
  }[]>().default([]),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Model performance tracking
export const pwinModelPerformance = pgTable("pwin_model_performance", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  // Model version
  modelVersion: varchar("model_version", { length: 50 }).notNull(),
  modelType: varchar("model_type", { length: 50 }), // weighted_avg, logistic, neural, ensemble

  // Performance metrics
  accuracy: real("accuracy"),
  precision: real("precision"),
  recall: real("recall"),
  f1Score: real("f1_score"),
  auc: real("auc"),
  brierScore: real("brier_score"),

  // Calibration
  calibrationData: jsonb("calibration_data").$type<{
    predictedBucket: number;
    actualWinRate: number;
    count: number;
  }[]>(),

  // Training data
  trainingSetSize: integer("training_set_size"),
  testSetSize: integer("test_set_size"),
  validationSetSize: integer("validation_set_size"),

  // Feature importance
  featureImportance: jsonb("feature_importance").$type<{
    factorId: string;
    factorName: string;
    importance: number;
    rank: number;
  }[]>(),

  // Cross-validation scores
  crossValidationScores: jsonb("cross_validation_scores").$type<number[]>(),

  isActive: boolean("is_active").default(false),

  trainedAt: timestamp("trained_at", { withTimezone: true }).defaultNow(),
  trainedBy: varchar("trained_by", { length: 200 }),
});

// Portfolio optimization results
export const portfolioOptimizations = pgTable("portfolio_optimizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),

  // Optimization parameters
  optimizationType: varchar("optimization_type", { length: 50 }), // maximize_wins, maximize_value, balanced
  resourceConstraint: real("resource_constraint"),

  // Results
  selectedOpportunities: jsonb("selected_opportunities").$type<{
    opportunityId: string;
    opportunityName: string;
    pwin: number;
    value: number;
    investmentRequired: number;
    expectedValue: number;
  }[]>(),

  // Portfolio metrics
  totalExpectedValue: real("total_expected_value"),
  totalInvestment: real("total_investment"),
  portfolioPwin: real("portfolio_pwin"),
  diversificationScore: real("diversification_score"),

  // Comparison with current
  improvementVsCurrent: real("improvement_vs_current"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 200 }),
});

// Relations
export const pwinFactorsRelations = relations(pwinFactors, ({ many }) => ({}));
export const pwinAssessmentsRelations = relations(pwinAssessments, ({ one }) => ({}));
export const pwinModelPerformanceRelations = relations(pwinModelPerformance, ({ one }) => ({}));
export const portfolioOptimizationsRelations = relations(portfolioOptimizations, ({ one }) => ({}));

// Type exports
export type PwinFactor = typeof pwinFactors.$inferSelect;
export type NewPwinFactor = typeof pwinFactors.$inferInsert;
export type PwinAssessment = typeof pwinAssessments.$inferSelect;
export type NewPwinAssessment = typeof pwinAssessments.$inferInsert;
export type PwinModelPerformance = typeof pwinModelPerformance.$inferSelect;
export type NewPwinModelPerformance = typeof pwinModelPerformance.$inferInsert;
export type PortfolioOptimization = typeof portfolioOptimizations.$inferSelect;
export type NewPortfolioOptimization = typeof portfolioOptimizations.$inferInsert;
