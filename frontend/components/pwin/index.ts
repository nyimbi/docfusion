/**
 * PWin (Probability of Win) Components
 *
 * A comprehensive suite of components for PWin assessment, analysis,
 * and portfolio optimization in the DocuFusion platform.
 *
 * Components:
 * - PwinAssessor: Main assessment form with factor sliders and scoring
 * - PwinDashboard: Portfolio overview with metrics and rankings
 * - FactorEditor: Create and manage PWin factors
 * - SensitivityChart: Visual sensitivity analysis
 * - RecommendationList: AI recommendations for improvement
 * - PortfolioOptimizer: Strategic resource allocation
 * - OpportunityComparison: Side-by-side opportunity analysis
 * - PwinHistoryChart: Historical PWin trends
 * - ModelPerformance: Model accuracy and calibration metrics
 * - RiskIndicators: Risk identification and mitigation
 *
 * @example
 * ```tsx
 * import {
 *   PwinAssessor,
 *   PwinDashboard,
 *   SensitivityChart,
 *   RecommendationList,
 * } from "@/components/pwin";
 *
 * // Render assessment page
 * <PwinAssessor
 *   opportunityId={id}
 *   opportunityName={name}
 *   onAssessmentComplete={handleComplete}
 * />
 * ```
 */

// ===================
// Main Components
// ===================

export { PwinAssessor } from "./PwinAssessor";
export { default as PwinAssessorDefault } from "./PwinAssessor";

export { PwinDashboard } from "./PwinDashboard";
export { default as PwinDashboardDefault } from "./PwinDashboard";

export { FactorEditor } from "./FactorEditor";
export { default as FactorEditorDefault } from "./FactorEditor";

// ===================
// Analysis Components
// ===================

export { SensitivityChart } from "./SensitivityChart";
export { default as SensitivityChartDefault } from "./SensitivityChart";

export { RecommendationList } from "./RecommendationList";
export { default as RecommendationListDefault } from "./RecommendationList";

export { PwinHistoryChart } from "./PwinHistoryChart";
export { default as PwinHistoryChartDefault } from "./PwinHistoryChart";

// ===================
// Portfolio Components
// ===================

export { PortfolioOptimizer } from "./PortfolioOptimizer";
export { default as PortfolioOptimizerDefault } from "./PortfolioOptimizer";

export { OpportunityComparison } from "./OpportunityComparison";
export { default as OpportunityComparisonDefault } from "./OpportunityComparison";

// ===================
// Performance & Risk
// ===================

export { ModelPerformance } from "./ModelPerformance";
export { default as ModelPerformanceDefault } from "./ModelPerformance";

export { RiskIndicators } from "./RiskIndicators";
export { default as RiskIndicatorsDefault } from "./RiskIndicators";
