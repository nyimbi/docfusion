/**
 * Integrated Cost Volume Generator Components
 *
 * A comprehensive set of React components for managing cost volumes,
 * labor categories, WBS structures, BOE narratives, and pricing analysis
 * for government proposals.
 *
 * @module components/pricing
 *
 * @example
 * ```tsx
 * import {
 *   CostVolumeManager,
 *   LaborCategoryManager,
 *   CostElementEditor,
 *   WBSTree,
 *   PricingSummary,
 *   CostTechnicalAlignment,
 *   HoursEstimator,
 *   BOEGenerator,
 *   IndirectRatesEditor,
 *   CostRealismPanel,
 *   LaborMixChart,
 *   TravelCalculator,
 *   CostComparisonView,
 * } from "@/components/pricing";
 *
 * // Main cost volume interface
 * <CostVolumeManager opportunityId={opportunityId} />
 *
 * // Labor category management
 * <LaborCategoryManager
 *   organizationId={orgId}
 *   onSelect={(cat) => setSelectedCategory(cat)}
 * />
 *
 * // Create/edit cost element
 * <CostElementEditor
 *   opportunityId={opportunityId}
 *   element={selectedElement}
 *   onSave={(el) => handleSave(el)}
 * />
 *
 * // WBS tree view
 * <WBSTree
 *   opportunityId={opportunityId}
 *   onSelectNode={(code) => selectWBS(code)}
 * />
 *
 * // Pricing summary
 * <PricingSummary opportunityId={opportunityId} showCharts />
 *
 * // Cost-technical alignment
 * <CostTechnicalAlignment opportunityId={opportunityId} />
 *
 * // AI hours estimation
 * <HoursEstimator
 *   sectionId={sectionId}
 *   onApply={(estimates) => applyEstimates(estimates)}
 * />
 *
 * // BOE narrative generation
 * <BOEGenerator costElementId={elementId} opportunityId={opportunityId} />
 *
 * // Indirect rates management
 * <IndirectRatesEditor organizationId={orgId} />
 *
 * // Cost realism analysis
 * <CostRealismPanel opportunityId={opportunityId} />
 *
 * // Labor mix chart
 * <LaborMixChart opportunityId={opportunityId} interactive />
 *
 * // Travel calculator
 * <TravelCalculator onCalculate={(cost, details) => addTravelCost(cost, details)} />
 *
 * // Scenario comparison
 * <CostComparisonView opportunityId={opportunityId} scenarioIds={scenarios} />
 * ```
 */

// =============================================================================
// Component Exports
// =============================================================================

/**
 * CostVolumeManager - Main cost volume interface
 *
 * Features:
 * - WBS tree view on left
 * - Cost elements list in center
 * - Summary panel on right
 * - Period/option tabs
 * - Add/edit/delete cost elements
 */
export { CostVolumeManager } from "./CostVolumeManager";
export type { CostVolumeManagerProps } from "./CostVolumeManager";

/**
 * LaborCategoryManager - Manage labor rates
 *
 * Features:
 * - Table view of labor categories
 * - Add/edit modal
 * - Rate effective dates
 * - GSA schedule info
 * - Import from CSV
 */
export { LaborCategoryManager } from "./LaborCategoryManager";
export type { LaborCategoryManagerProps } from "./LaborCategoryManager";

/**
 * CostElementEditor - Create/edit cost element
 *
 * Features:
 * - Tabbed interface: Labor, ODC, Subcontract, Travel, Material
 * - Labor category picker with rate lookup
 * - Hours input with calculator
 * - ODC vendor/quote fields
 * - Subcontractor details
 * - Travel calculator
 * - BOE narrative editor
 */
export { CostElementEditor } from "./CostElementEditor";
export type { CostElementEditorProps } from "./CostElementEditor";

/**
 * WBSTree - Work Breakdown Structure
 *
 * Features:
 * - Hierarchical tree view
 * - Drag-and-drop reordering
 * - Link to technical sections
 * - Cost rollup at each level
 * - Expand/collapse all
 */
export { WBSTree } from "./WBSTree";
export type { WBSTreeProps } from "./WBSTree";

/**
 * PricingSummary - Pricing roll-up
 *
 * Features:
 * - Period-by-period breakdown
 * - Grand total section
 * - Indirect rates display
 * - Labor mix pie chart
 * - Cost type breakdown bar chart
 */
export { PricingSummary } from "./PricingSummary";
export type { PricingSummaryProps } from "./PricingSummary";

/**
 * CostTechnicalAlignment - Alignment validation
 *
 * Features:
 * - Side-by-side technical vs cost
 * - Alignment score gauge
 * - Issues list with severity
 * - "Link Cost" action for unlinked sections
 * - Recommendations
 */
export { CostTechnicalAlignment } from "./CostTechnicalAlignment";
export type { CostTechnicalAlignmentProps } from "./CostTechnicalAlignment";

/**
 * HoursEstimator - AI hours estimation
 *
 * Features:
 * - Section selector
 * - Complexity selector
 * - "Estimate" button
 * - Results by labor category
 * - Confidence indicators
 * - "Apply to Cost Elements" action
 */
export { HoursEstimator } from "./HoursEstimator";
export type { HoursEstimatorProps } from "./HoursEstimator";

/**
 * BOEGenerator - BOE narrative generation
 *
 * Features:
 * - Cost element selector
 * - Template picker
 * - AI-generated narrative preview
 * - Edit capability
 * - Save/Apply buttons
 */
export { BOEGenerator } from "./BOEGenerator";
export type { BOEGeneratorProps } from "./BOEGenerator";

/**
 * IndirectRatesEditor - Manage indirect rates
 *
 * Features:
 * - Overhead, G&A, Fee rates
 * - Effective dates
 * - DCAA approval info
 * - Rate history
 */
export { IndirectRatesEditor } from "./IndirectRatesEditor";
export type { IndirectRatesEditorProps } from "./IndirectRatesEditor";

/**
 * CostRealismPanel - Cost realism analysis
 *
 * Features:
 * - Overall assessment badge
 * - Factor breakdown
 * - Risk table
 * - Generated narrative
 * - "Re-analyze" button
 */
export { CostRealismPanel } from "./CostRealismPanel";
export type { CostRealismPanelProps } from "./CostRealismPanel";

/**
 * LaborMixChart - Labor category distribution
 *
 * Features:
 * - Donut/pie chart
 * - Hours and cost percentages
 * - Category legend
 * - Click to filter
 */
export { LaborMixChart } from "./LaborMixChart";
export type { LaborMixChartProps } from "./LaborMixChart";

/**
 * TravelCalculator - Travel cost calculator
 *
 * Features:
 * - Trip details form
 * - Per diem lookup
 * - Mileage calculator
 * - Total computation
 */
export { TravelCalculator } from "./TravelCalculator";
export type { TravelCalculatorProps } from "./TravelCalculator";

/**
 * CostComparisonView - Compare pricing scenarios
 *
 * Features:
 * - Multiple scenario columns
 * - Delta highlighting
 * - Percentage comparisons
 */
export { CostComparisonView } from "./CostComparisonView";
export type { CostComparisonViewProps } from "./CostComparisonView";

// =============================================================================
// Re-export Types from lib/types/pricing
// =============================================================================

export type {
	// Database types
	CostElementType,
	PeriodType,
	CostElementStatus,
	IndirectRateType,
	LaborCategory,
	CostElement,
	IndirectRate,
	BoeTemplate,
	LaborMixEntry,
	CostRiskFactor,
	AlignmentIssue,

	// Action types
	ActionResult,
	CreateLaborCategoryInput,
	UpdateLaborCategoryInput,
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

	// UI-specific types
	LaborLevel,
	ContractType,
	AlignmentStatus,
	CostRealismRisk,
	ComplexityLevel,
	BOETemplateType,
	WBSNode,
	WBSTree as WBSTreeData,
	ContractPeriod,
	TravelDetails,
	PricingScenario,
	ScenarioComparison,
	ScenarioComparisonItem,
	LaborCategoryFilters,
	CostTechnicalAlignment as CostTechnicalAlignmentData,
	BOENarrative,
	LaborHoursEstimate,
	HoursEstimateResult,
	IndirectRateHistory,
	PeriodCostSummary,
	PricingSummary as PricingSummaryData,
	CostRealismFactor,
	CostRealismRiskItem,
	CostRealismAnalysisUI,
} from "@/lib/types/pricing";
