/**
 * Government-Specific Formatting Engine Components
 *
 * A comprehensive set of React components for document formatting,
 * validation, accessibility checking, and compliance with government
 * RFP requirements (FAR, DFARS, agency-specific formatting).
 *
 * @module components/formatting
 *
 * @example
 * ```tsx
 * import {
 *   FormatTemplateSelector,
 *   FormatValidator,
 *   PageCountTracker,
 *   AccessibilityChecker,
 *   TOCGenerator,
 *   ListGenerator,
 *   HeaderFooterEditor,
 *   FormatPreview,
 *   FormatIssueList,
 * } from "@/components/formatting";
 *
 * // Apply formatting template
 * <FormatTemplateSelector
 *   documentId={docId}
 *   onApply={(template) => console.log("Applied:", template.name)}
 * />
 *
 * // Validate document formatting
 * <FormatValidator
 *   documentId={docId}
 *   showDetails
 *   onIssueClick={(issue) => navigateToIssue(issue)}
 * />
 *
 * // Track page counts
 * <PageCountTracker
 *   documentId={docId}
 *   showVolumes
 * />
 *
 * // Check accessibility compliance
 * <AccessibilityChecker
 *   documentId={docId}
 *   targetLevel="AA"
 * />
 *
 * // Generate table of contents
 * <TOCGenerator
 *   documentId={docId}
 *   onInsert={(entries) => insertTOC(entries)}
 * />
 *
 * // Generate lists
 * <ListGenerator
 *   documentId={docId}
 *   type="all"
 * />
 *
 * // Edit headers and footers
 * <HeaderFooterEditor
 *   documentId={docId}
 *   onSave={(settings) => saveSettings(settings)}
 * />
 *
 * // Preview formatted document
 * <FormatPreview
 *   documentId={docId}
 *   templateId={templateId}
 * />
 *
 * // Display issue list
 * <FormatIssueList
 *   issues={formatIssues}
 *   onIssueClick={(issue) => navigateToIssue(issue)}
 *   onAutoFix={(ids) => fixIssues(ids)}
 * />
 * ```
 */

// =============================================================================
// Component Exports
// =============================================================================

/**
 * FormatTemplateSelector - Select and apply government formatting templates
 *
 * Features:
 * - Dropdown selection of available agency templates
 * - Template details display (agency, page size, margins, fonts)
 * - Apply button with loading and error states
 * - Success confirmation
 */
export { FormatTemplateSelector } from "./FormatTemplateSelector";
export type { FormatTemplateSelectorProps } from "./FormatTemplateSelector";

/**
 * FormatValidator - Validate document formatting compliance
 *
 * Features:
 * - Overall compliance score with color-coded gauge
 * - Issue list grouped by severity (critical, major, minor)
 * - Expandable issue details with suggestions
 * - Re-validate button
 * - Auto-fix capability for fixable issues
 */
export { FormatValidator } from "./FormatValidator";
export type { FormatValidatorProps } from "./FormatValidator";

/**
 * PageCountTracker - Track document pages against limits
 *
 * Features:
 * - Current page count vs limit display
 * - Progress bar visualization with status colors
 * - Per-volume breakdown for multi-volume proposals
 * - Warning indicators when approaching limits
 * - Compact mode for toolbar integration
 */
export { PageCountTracker } from "./PageCountTracker";
export type { PageCountTrackerProps } from "./PageCountTracker";

/**
 * AccessibilityChecker - Section 508 and WCAG compliance checking
 *
 * Features:
 * - Accessibility score display
 * - WCAG level indicator (A, AA, AAA)
 * - Section 508 compliance status
 * - Issue list with remediation guidance
 * - Category breakdown (images, color, navigation, etc.)
 */
export { AccessibilityChecker } from "./AccessibilityChecker";
export type { AccessibilityCheckerProps } from "./AccessibilityChecker";

/**
 * TOCGenerator - Generate table of contents
 *
 * Features:
 * - Preview of generated TOC with hierarchy
 * - Configurable heading level depth
 * - Toggle figures, tables, acronyms inclusion
 * - Section numbering options
 * - Leader style selection (dots, dashes, etc.)
 * - Insert button to add to document
 */
export { TOCGenerator } from "./TOCGenerator";
export type { TOCGeneratorProps } from "./TOCGenerator";

/**
 * ListGenerator - Generate lists of figures, tables, and acronyms
 *
 * Features:
 * - Tabbed interface for Figures, Tables, Acronyms
 * - Preview of each list with page numbers
 * - Individual insert buttons per list type
 * - Single list type mode or all mode
 */
export { ListGenerator } from "./ListGenerator";
export type { ListGeneratorProps } from "./ListGenerator";

/**
 * HeaderFooterEditor - Customize document headers and footers
 *
 * Features:
 * - Visual editor for left/center/right positions
 * - Token insertion (page, pages, date, title)
 * - Page number format selector
 * - Different first page toggle
 * - Live preview of header/footer appearance
 * - Save/reset functionality
 */
export { HeaderFooterEditor } from "./HeaderFooterEditor";
export type { HeaderFooterEditorProps } from "./HeaderFooterEditor";

/**
 * FormatPreview - Preview formatted document appearance
 *
 * Features:
 * - Simulated page view with margins and fonts
 * - Header and footer preview
 * - Page number preview
 * - Zoom controls
 * - Page navigation
 * - Template information display
 */
export { FormatPreview } from "./FormatPreview";
export type { FormatPreviewProps } from "./FormatPreview";

/**
 * FormatIssueList - Display and manage format issues
 *
 * Features:
 * - Filterable by severity and category
 * - Sortable by severity, category, or title
 * - Search functionality
 * - Click to navigate to issue location
 * - Bulk selection for batch actions
 * - Auto-fix and dismiss actions
 * - Severity badges with color coding
 */
export { FormatIssueList } from "./FormatIssueList";
export type { FormatIssueListProps } from "./FormatIssueList";

// =============================================================================
// Re-export Types from lib/types/formatting
// =============================================================================

export type {
	// Template types
	FormatTemplate,
	FormatTemplateId,
	GovernmentAgency,
	PageSize,
	FontFamily,
	LineSpacing,
	MarginSettings,
	FontSettings,
	VolumePageLimit,

	// Header/Footer types
	HeaderFooterSettings,
	HeaderFooterElement,
	HeaderFooterPosition,
	PageNumberFormat,

	// Validation types
	FormatValidationResult,
	FormatIssue,
	FormatIssueId,
	IssueSeverity,
	IssueCategory,
	IssueLocation,

	// Page tracking types
	PageCountInfo,
	VolumePageCount,

	// Accessibility types
	AccessibilityResult,
	AccessibilityIssue,
	AccessibilityCategory,
	WCAGLevel,

	// TOC types
	TOCEntry,
	TOCEntryId,
	TOCConfig,
	TOCResult,
	HeadingLevel,

	// List types
	FigureEntry,
	TableEntry,
	AcronymEntry,
	ListsResult,

	// Preview types
	FormatPreviewResult,
	PreviewPage,

	// Input types
	ApplyTemplateInput,
	ValidateFormatInput,
	CheckAccessibilityInput,
	GenerateTOCInput,
	GenerateListsInput,
	UpdateHeaderFooterInput,
	GeneratePreviewInput,
	AutoFixIssuesInput,
} from "@/lib/types/formatting";
