/**
 * Win Theme Orchestration Engine Components
 *
 * A comprehensive set of React components for managing win themes,
 * analyzing theme consistency, generating AI suggestions, and
 * optimizing competitive positioning in proposals.
 *
 * @module components/win-themes
 *
 * @example
 * ```tsx
 * import {
 *   ThemeManager,
 *   ThemeEditor,
 *   ThemeSuggestions,
 *   ThemeHeatMap,
 *   ThemeConsistencyAnalyzer,
 *   ThemeInjectionSuggestions,
 *   GhostThemePanel,
 *   ThemeOccurrencesList,
 *   CriteriaThemeMapping,
 *   ThemeSummaryCard,
 *   ThemeReinforcementGenerator,
 * } from "@/components/win-themes";
 *
 * // Main theme management
 * <ThemeManager
 *   opportunityId={opportunityId}
 *   onThemeSelect={(theme) => setSelectedTheme(theme)}
 * />
 *
 * // Create/edit themes
 * <ThemeEditor
 *   opportunityId={opportunityId}
 *   theme={selectedTheme}
 *   onSave={(theme) => handleSave(theme)}
 * />
 *
 * // AI suggestions
 * <ThemeSuggestions
 *   opportunityId={opportunityId}
 *   onAccept={(suggestion) => handleAccept(suggestion)}
 * />
 *
 * // Coverage visualization
 * <ThemeHeatMap
 *   opportunityId={opportunityId}
 *   onCellClick={(themeId, sectionId) => showDetails(themeId, sectionId)}
 * />
 *
 * // Consistency analysis
 * <ThemeConsistencyAnalyzer opportunityId={opportunityId} />
 *
 * // Injection suggestions
 * <ThemeInjectionSuggestions
 *   opportunityId={opportunityId}
 *   themeId={selectedThemeId}
 *   onAccept={(injection) => applyInjection(injection)}
 * />
 *
 * // Competitive positioning
 * <GhostThemePanel
 *   opportunityId={opportunityId}
 *   onAddToThemes={(suggestion) => addGhostTheme(suggestion)}
 * />
 *
 * // Theme occurrences
 * <ThemeOccurrencesList
 *   themeId={selectedThemeId}
 *   onNavigate={(occurrence) => navigateTo(occurrence)}
 * />
 *
 * // Criteria mapping
 * <CriteriaThemeMapping opportunityId={opportunityId} />
 *
 * // Summary widget
 * <ThemeSummaryCard opportunityId={opportunityId} compact />
 *
 * // Reinforcement generator
 * <ThemeReinforcementGenerator
 *   opportunityId={opportunityId}
 *   themeId={selectedThemeId}
 *   sectionId={currentSectionId}
 *   onInsert={(text) => insertAtCursor(text)}
 * />
 * ```
 */

// =============================================================================
// Component Exports
// =============================================================================

/**
 * ThemeManager - Main theme management interface
 *
 * Features:
 * - List of win themes with drag-to-reorder
 * - Create/edit/delete themes
 * - Priority badges and type indicators
 * - Expandable theme details
 * - Status management (active/archived)
 */
export { ThemeManager } from "./ThemeManager";
export type { ThemeManagerProps } from "./ThemeManager";

/**
 * ThemeEditor - Create/edit theme form
 *
 * Features:
 * - Theme statement (rich text)
 * - Short version (character limit indicator)
 * - Type selector (value_prop, differentiator, proof_point, risk_mitigation)
 * - Priority slider
 * - Supporting evidence picker
 * - Related projects selector
 * - Ghost theme section (competitor, counter-positioning)
 */
export { ThemeEditor } from "./ThemeEditor";
export type { ThemeEditorProps } from "./ThemeEditor";

/**
 * ThemeSuggestions - AI-suggested themes
 *
 * Features:
 * - "Generate Suggestions" button
 * - Loading state with progress
 * - List of suggested themes with confidence scores
 * - Rationale for each suggestion
 * - "Accept" / "Dismiss" / "Edit & Accept" actions
 */
export { ThemeSuggestions } from "./ThemeSuggestions";
export type { ThemeSuggestionsProps } from "./ThemeSuggestions";

/**
 * ThemeHeatMap - Visual theme coverage
 *
 * Features:
 * - Grid/matrix view: sections vs themes
 * - Color-coded cells (green=strong, yellow=weak, red=missing)
 * - Click cell to see occurrences
 * - Volume grouping
 * - Filter by theme type
 * - Fullscreen mode
 */
export { ThemeHeatMap } from "./ThemeHeatMap";
export type { ThemeHeatMapProps } from "./ThemeHeatMap";

/**
 * ThemeConsistencyAnalyzer - Consistency analysis view
 *
 * Features:
 * - Overall consistency score gauge
 * - Gap list with severity badges
 * - Inconsistency warnings
 * - Recommendations panel
 * - "Re-analyze" button
 * - Score breakdown by category
 */
export { ThemeConsistencyAnalyzer } from "./ThemeConsistencyAnalyzer";
export type { ThemeConsistencyAnalyzerProps } from "./ThemeConsistencyAnalyzer";

/**
 * ThemeInjectionSuggestions - AI injection points
 *
 * Features:
 * - List of suggested injection locations
 * - Before/after preview
 * - Impact score display
 * - Accept/Reject/Modify actions
 * - Filter by theme, section, impact
 */
export { ThemeInjectionSuggestions } from "./ThemeInjectionSuggestions";
export type { ThemeInjectionSuggestionsProps } from "./ThemeInjectionSuggestions";

/**
 * GhostThemePanel - Competitive positioning
 *
 * Features:
 * - Competitor profile management
 * - Ghost theme suggestions
 * - Subtlety level indicator
 * - "Add to Themes" action
 * - Threat level badges
 */
export { GhostThemePanel } from "./GhostThemePanel";
export type { GhostThemePanelProps } from "./GhostThemePanel";

/**
 * ThemeOccurrencesList - Where themes appear
 *
 * Features:
 * - List of all occurrences for a theme
 * - Location details (section, page, paragraph)
 * - Strength indicator
 * - Navigate to occurrence
 * - Verify/unverify toggles
 * - Filter by strength and verification status
 */
export { ThemeOccurrencesList } from "./ThemeOccurrencesList";
export type { ThemeOccurrencesListProps } from "./ThemeOccurrencesList";

/**
 * CriteriaThemeMapping - Map themes to evaluation criteria
 *
 * Features:
 * - Criteria list with mapped themes
 * - Coverage score per criteria
 * - Drag themes to criteria
 * - Weight visualization
 * - Auto-suggest mappings
 */
export { CriteriaThemeMapping } from "./CriteriaThemeMapping";
export type { CriteriaThemeMappingProps } from "./CriteriaThemeMapping";

/**
 * ThemeSummaryCard - Quick stats widget
 *
 * Features:
 * - Total/active theme count
 * - Coverage percentage
 * - Strongest/weakest theme
 * - Critical gaps count
 * - Mini heat map preview
 * - Compact mode for dashboards
 */
export { ThemeSummaryCard } from "./ThemeSummaryCard";
export type { ThemeSummaryCardProps } from "./ThemeSummaryCard";

/**
 * ThemeReinforcementGenerator - Generate reinforcement text
 *
 * Features:
 * - Section selector
 * - Theme selector
 * - Generated text preview
 * - Multiple phrasing options
 * - Copy/insert actions
 * - Tone and length controls
 */
export { ThemeReinforcementGenerator } from "./ThemeReinforcementGenerator";
export type { ThemeReinforcementGeneratorProps } from "./ThemeReinforcementGenerator";

/**
 * ResponseWinThemeSeedReview - Review generated response-package win-theme seeds
 *
 * Features:
 * - Approve/reject decisions before persistence
 * - Reviewer note capture
 * - Evaluator criteria, requirement, and evidence visibility
 * - Bulk persistence for approved seeds only
 */
export { ResponseWinThemeSeedReview } from "./ResponseWinThemeSeedReview";
export type { ResponseWinThemeSeedReviewProps } from "./ResponseWinThemeSeedReview";

// =============================================================================
// Re-export Types from lib/types/win-themes
// =============================================================================

export type {
	// Core identifiers
	WinThemeId,
	ThemeSuggestionId,
	ThemeOccurrenceId,
	InjectionPointId,
	GhostThemeId,
	CompetitorId,
	CriteriaMappingId,

	// Theme types
	WinTheme,
	WinThemeType,
	ThemePriority,
	ThemeStrength,
	ThemeStatus,
	GhostTheme,
	ThemeCoverageMetrics,
	CreateWinThemeInput,
	UpdateWinThemeInput,
	ResponseWinThemeSeedInput,
	ResponseWinThemeSeedReviewDecision,
	CreateThemesFromResponseSeedsInput,

	// Suggestions
	ThemeSuggestion,
	GenerateThemeSuggestionsInput,

	// Heat map
	ThemeHeatMap as ThemeHeatMapData,
	HeatMapCell,
	HeatMapSection,
	HeatMapVolume,

	// Occurrences
	ThemeOccurrence,
	VerifyOccurrenceInput,

	// Consistency
	ConsistencyAnalysis,
	ConsistencyIssue,
	ConsistencyIssueSeverity,
	ConsistencyIssueType,
	ConsistencyRecommendation,

	// Injection
	InjectionPoint,
	InjectionImpact,
	InjectionFilters,
	GenerateInjectionsInput,

	// Competitors
	Competitor,
	CreateCompetitorInput,
	GhostThemeSuggestion,

	// Criteria mapping
	CriteriaThemeMapping as CriteriaThemeMappingData,
	MapThemesToCriteriaInput,

	// Summary
	ThemeSummary,

	// Reinforcement
	ReinforcementText,
	GenerateReinforcementInput,
} from "@/lib/types/win-themes";
