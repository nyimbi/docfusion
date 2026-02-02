/**
 * Predictive Win Probability Engine Types
 */

// Re-export database types
import type {
  PwinFactor as _PwinFactor,
  PwinAssessment as _PwinAssessment,
  PwinModelPerformance as _PwinModelPerformance,
  PortfolioOptimization as _PortfolioOptimization,
} from "@/lib/db/schema-pwin";

export type PwinFactor = _PwinFactor;
export type PwinAssessment = _PwinAssessment;
export type PwinModelPerformance = _PwinModelPerformance;
export type PortfolioOptimization = _PortfolioOptimization;

// Factor categories
export type FactorCategory = "customer" | "solution" | "competition" | "team" | "price" | "contract";
export type AssessmentType = "initial" | "mid_capture" | "final" | "gate_review";
export type Priority = "high" | "medium" | "low";
export type Effort = "low" | "medium" | "high";
export type Timeframe = "immediate" | "short_term" | "long_term";
export type OptimizationType = "maximize_wins" | "maximize_value" | "balanced";

// Factor score input
export interface FactorScore {
  factorId: string;
  factorName: string;
  score: number;
  weight: number;
  notes?: string;
}

// Sensitivity analysis result
export interface SensitivityResult {
  factorId: string;
  factorName: string;
  currentScore: number;
  maxScore: number;
  weight: number;
  impactIfMaximized: number;
  impactPerPoint: number;
  improvementPotential: number;
  priority: Priority;
}

// Recommendation
export interface PwinRecommendation {
  recommendation: string;
  priority: Priority;
  factorId?: string;
  factorName?: string;
  expectedImpact: number;
  effort: Effort;
  timeframe: Timeframe;
}

// Risk
export interface PwinRisk {
  riskId: string;
  riskType: "score_gap" | "declining_trend" | "competitive_threat" | "timeline" | "resource";
  severity: Priority;
  description: string;
  relatedFactorId?: string;
  mitigationActions: string[];
}

// Confidence interval
export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number;
}

// PWin report
export interface PwinReport {
  opportunityId: string;
  opportunityName: string;
  currentPwin: number;
  confidenceInterval: ConfidenceInterval;
  factorScores: FactorScore[];
  sensitivityAnalysis: SensitivityResult[];
  recommendations: PwinRecommendation[];
  risks: PwinRisk[];
  historicalTrend: { date: Date; pwin: number }[];
  generatedAt: Date;
}

// Portfolio metrics
export interface PortfolioMetrics {
  totalOpportunities: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  averagePwin: number;
  expectedWins: number;
  atRiskCount: number;
  pwinDistribution: { range: string; count: number }[];
  byCategory?: Record<string, { count: number; value: number; avgPwin: number }>;
}

// Opportunity ranking
export interface OpportunityRanking {
  rank: number;
  opportunityId: string;
  opportunityName: string;
  pwin: number;
  value: number;
  expectedValue: number;
  stage?: string;
}

// Opportunity comparison
export interface OpportunityComparison {
  opportunities: Array<{
    opportunityId: string;
    opportunityName: string;
    pwin: number;
    value: number;
    expectedValue: number;
    factorScores: FactorScore[];
    strengths: string[];
    weaknesses: string[];
  }>;
  recommendations: string[];
}

// Model training result
export interface ModelTrainingResult {
  modelVersion: string;
  trainingSetSize: number;
  testSetSize: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
    brierScore: number;
  };
  featureImportance: { factorId: string; factorName: string; importance: number }[];
  trainedAt: Date;
}

// Model validation
export interface ModelValidation {
  predictionsEvaluated: number;
  correctPredictions: number;
  accuracy: number;
  calibrationError: number;
  byConfidenceLevel: Array<{
    confidenceRange: { min: number; max: number };
    predictions: number;
    correct: number;
    accuracy: number;
  }>;
}

// Calibration data
export interface CalibrationData {
  buckets: Array<{
    predictedRange: { min: number; max: number };
    count: number;
    actualWins: number;
    actualWinRate: number;
    expectedWinRate: number;
    calibrationError: number;
  }>;
  overallCalibrationError: number;
  brierScore: number;
  reliability: number;
  resolution: number;
}

// Forecast
export interface PwinForecast {
  opportunities: Array<{
    opportunityId: string;
    opportunityName: string;
    currentPwin: number;
    predictedOutcome: "win" | "loss" | "uncertain";
    confidence: ConfidenceInterval;
    expectedDecisionDate?: Date;
  }>;
  expectedWins: number;
  expectedLosses: number;
  uncertainCount: number;
  forecastedPipelineValue: number;
}

// Default factor configuration
export const DEFAULT_FACTORS: Array<{
  name: string;
  category: FactorCategory;
  description: string;
  weight: number;
  guidelines: Array<{ score: number; description: string }>;
}> = [
  {
    name: "Customer Relationship",
    category: "customer",
    description: "Strength of existing relationship with the customer",
    weight: 2.5,
    guidelines: [
      { score: 0, description: "No relationship" },
      { score: 5, description: "Some contact/awareness" },
      { score: 10, description: "Strong incumbent relationship" },
    ],
  },
  {
    name: "Incumbent Status",
    category: "competition",
    description: "Whether we are the incumbent contractor",
    weight: 1.5,
    guidelines: [
      { score: 0, description: "Strong incumbent competitor" },
      { score: 5, description: "No incumbent or mixed" },
      { score: 10, description: "We are the incumbent" },
    ],
  },
  {
    name: "Solution Fit",
    category: "solution",
    description: "How well our solution matches requirements",
    weight: 2.0,
    guidelines: [
      { score: 0, description: "Major gaps in capability" },
      { score: 5, description: "Meets most requirements" },
      { score: 10, description: "Perfect fit, exceeds requirements" },
    ],
  },
  {
    name: "Price Competitiveness",
    category: "price",
    description: "Expected price position relative to competitors",
    weight: 1.5,
    guidelines: [
      { score: 0, description: "Significantly higher than competition" },
      { score: 5, description: "Competitive pricing" },
      { score: 10, description: "Strong price advantage" },
    ],
  },
  {
    name: "Past Performance Match",
    category: "solution",
    description: "Relevance and quality of past performance",
    weight: 1.0,
    guidelines: [
      { score: 0, description: "No relevant experience" },
      { score: 5, description: "Some relevant experience" },
      { score: 10, description: "Excellent relevant experience" },
    ],
  },
  {
    name: "Team Qualifications",
    category: "team",
    description: "Strength and availability of proposed team",
    weight: 1.0,
    guidelines: [
      { score: 0, description: "Key positions unfilled" },
      { score: 5, description: "Adequate team identified" },
      { score: 10, description: "All-star team committed" },
    ],
  },
  {
    name: "Competitive Position",
    category: "competition",
    description: "Overall competitive landscape assessment",
    weight: 0.5,
    guidelines: [
      { score: 0, description: "Many strong competitors" },
      { score: 5, description: "Moderate competition" },
      { score: 10, description: "Weak/no competition" },
    ],
  },
];
