/**
 * Evidence & Proof Point Optimizer Components
 *
 * A comprehensive set of React components for managing evidence libraries,
 * analyzing document claims, tracking usage, and optimizing proof points
 * in government proposals.
 *
 * @module components/evidence
 *
 * @example
 * ```tsx
 * import {
 *   EvidenceLibrary,
 *   EvidenceEditor,
 *   EvidenceSearch,
 *   ClaimAnalyzer,
 *   ClaimDetailPanel,
 *   EvidenceMatrix,
 *   EvidenceStrengthCard,
 *   QuantificationAssistant,
 *   EvidenceUsageTracker,
 *   EvidenceImporter,
 *   EvidenceDistributionChart,
 *   EvidencePicker,
 * } from "@/components/evidence";
 *
 * // Main evidence management
 * <EvidenceLibrary
 *   organizationId={organizationId}
 *   onSelect={(evidence) => setSelectedEvidence(evidence)}
 * />
 *
 * // Create/edit evidence
 * <EvidenceEditor
 *   evidence={selectedEvidence}
 *   onSave={(evidence) => handleSave(evidence)}
 * />
 *
 * // Search evidence
 * <EvidenceSearch
 *   onSelect={(evidence) => insertEvidence(evidence)}
 *   preFilters={{ types: ["metric", "case_study"] }}
 * />
 *
 * // Analyze document claims
 * <ClaimAnalyzer
 *   documentId={documentId}
 *   onClaimClick={(claim) => showClaimDetails(claim)}
 * />
 *
 * // Claim detail view
 * <ClaimDetailPanel
 *   claimId={selectedClaimId}
 *   onResolve={() => refreshClaims()}
 * />
 *
 * // Coverage matrix
 * <EvidenceMatrix
 *   opportunityId={opportunityId}
 *   matrixType="evaluation_criteria"
 * />
 *
 * // Strength analysis
 * <EvidenceStrengthCard evidenceId={evidenceId} />
 *
 * // Quantification helper
 * <QuantificationAssistant
 *   claim={claimText}
 *   onApply={(text) => updateClaim(text)}
 * />
 *
 * // Usage tracking
 * <EvidenceUsageTracker evidenceId={evidenceId} />
 *
 * // Bulk import
 * <EvidenceImporter onComplete={(result) => handleImportComplete(result)} />
 *
 * // Distribution charts
 * <EvidenceDistributionChart opportunityId={opportunityId} />
 *
 * // Inline picker
 * <EvidencePicker
 *   onSelect={(evidence) => insertEvidence(evidence)}
 *   context={currentSectionText}
 * />
 * ```
 */

// =============================================================================
// Component Exports
// =============================================================================

/**
 * EvidenceLibrary - Main evidence management interface
 *
 * Features:
 * - Searchable, filterable evidence list
 * - Grid/list view toggle
 * - Evidence type tabs
 * - Strength tier badges (gold/silver/bronze)
 * - Use count indicators
 * - Quick actions (edit, duplicate, archive)
 */
export { EvidenceLibrary } from "./EvidenceLibrary";
export type { EvidenceLibraryProps } from "./EvidenceLibrary";

/**
 * EvidenceEditor - Create/edit evidence form
 *
 * Features:
 * - Title and content fields
 * - Evidence type selector
 * - Category/subcategory dropdowns
 * - Tags input
 * - Quantification section
 * - Source information fields
 * - Related capabilities picker
 * - Strength score preview
 */
export { EvidenceEditor } from "./EvidenceEditor";
export type { EvidenceEditorProps } from "./EvidenceEditor";

/**
 * EvidenceSearch - Advanced search interface
 *
 * Features:
 * - Search input with instant results
 * - Filters panel
 * - Search results with relevance scores
 * - "Add to document" quick action
 */
export { EvidenceSearch } from "./EvidenceSearch";
export type { EvidenceSearchProps } from "./EvidenceSearch";

/**
 * ClaimAnalyzer - Document claim analysis
 *
 * Features:
 * - Analyze button to scan document
 * - Claims list with risk indicators
 * - Evidence strength badges per claim
 * - Expandable claim details
 * - "Suggest Evidence" action per claim
 */
export { ClaimAnalyzer } from "./ClaimAnalyzer";
export type { ClaimAnalyzerProps } from "./ClaimAnalyzer";

/**
 * ClaimDetailPanel - Single claim view
 *
 * Features:
 * - Claim text with highlight
 * - Location info
 * - Linked evidence list
 * - Suggested evidence with relevance scores
 * - Quantification suggestions
 * - Resolution workflow
 */
export { ClaimDetailPanel } from "./ClaimDetailPanel";
export type { ClaimDetailPanelProps } from "./ClaimDetailPanel";

/**
 * EvidenceMatrix - Coverage matrix view
 *
 * Features:
 * - Interactive grid (criteria vs evidence types)
 * - Cell colors based on coverage
 * - Click cell to see/add evidence
 * - Gap highlighting
 * - Export button
 */
export { EvidenceMatrix } from "./EvidenceMatrix";
export type { EvidenceMatrixProps } from "./EvidenceMatrix";

/**
 * EvidenceStrengthCard - Strength analysis display
 *
 * Features:
 * - Overall score gauge
 * - Tier badge
 * - Dimension breakdown
 * - Improvement suggestions
 */
export { EvidenceStrengthCard } from "./EvidenceStrengthCard";
export type { EvidenceStrengthCardProps } from "./EvidenceStrengthCard";

/**
 * QuantificationAssistant - Help quantify claims
 *
 * Features:
 * - Input claim text
 * - AI-generated quantified versions
 * - Metric suggestions
 * - Data source hints
 * - Apply action
 */
export { QuantificationAssistant } from "./QuantificationAssistant";
export type { QuantificationAssistantProps } from "./QuantificationAssistant";

/**
 * EvidenceUsageTracker - Track usage history
 *
 * Features:
 * - Usage timeline
 * - By opportunity breakdown
 * - Effectiveness ratings
 * - Most/least used indicators
 */
export { EvidenceUsageTracker } from "./EvidenceUsageTracker";
export type { EvidenceUsageTrackerProps } from "./EvidenceUsageTracker";

/**
 * EvidenceImporter - Bulk import evidence
 *
 * Features:
 * - CSV/Excel upload
 * - Column mapping interface
 * - Preview before import
 * - Import progress
 * - Error handling with skip/retry
 */
export { EvidenceImporter } from "./EvidenceImporter";
export type { EvidenceImporterProps } from "./EvidenceImporter";

/**
 * EvidenceDistributionChart - Visual distribution
 *
 * Features:
 * - Pie/donut chart by type
 * - Bar chart by strength
 * - Coverage gauge
 * - Gaps list
 */
export { EvidenceDistributionChart } from "./EvidenceDistributionChart";
export type { EvidenceDistributionChartProps } from "./EvidenceDistributionChart";

/**
 * EvidencePicker - Inline evidence selector
 *
 * Features:
 * - Compact search/filter
 * - Quick results list
 * - Drag-and-drop to insert
 * - Recently used section
 */
export { EvidencePicker } from "./EvidencePicker";
export type { EvidencePickerProps } from "./EvidencePicker";

// =============================================================================
// Re-export Types from lib/types/evidence
// =============================================================================

export type {
	// Core identifiers
	EvidenceId,
	ClaimId,
	ClaimAnalysisId,

	// Evidence types
	Evidence,
	EvidenceType,
	EvidenceCategory,
	EvidenceStrengthTier,
	EvidenceStatus,
	EvidenceQuantification,
	EvidenceSource,
	StrengthDimensions,
	CreateEvidenceInput,
	UpdateEvidenceInput,

	// Claim analysis
	ClaimAnalysis,
	ClaimAnalysisSummary,
	ClaimRiskLevel,
	ClaimType,

	// Matrix
	EvidenceMatrix as EvidenceMatrixData,
	EvidenceMatrixCell,
	MatrixType,

	// Search
	EvidenceFilters,
	EvidenceSearchResult,

	// Quantification
	QuantificationSuggestion,

	// Usage tracking
	EvidenceUsage,
	EvidenceUsageStats,

	// Import
	ImportResult,
	ImportColumnMapping,
	ImportPreviewRow,

	// Distribution
	EvidenceDistribution,
} from "@/lib/types/evidence";
