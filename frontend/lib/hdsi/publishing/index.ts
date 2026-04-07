/**
 * HDSI Publishing Submodule
 *
 * Document production, export, compliance tracking,
 * presentations, and PPTX generation.
 *
 * Dependency graph:
 *   publishing           -> core/types
 *   auto-index           -> core/types, publishing
 *   export               -> core/types, publishing, auto-index
 *   compliance            -> (none)
 *   presentations        -> core/types
 *   presentation-formats -> presentations, core/types
 *   pptx-export          -> presentations, presentation-formats
 */

// Publishing system (bibliography, TOC, cross-refs, page layout, watermarks)
export {
  usePublishing,
  BIBLIOGRAPHY_STYLES,
  DEFAULT_PAGE_LAYOUT,
  WATERMARK_PRESETS,
  generateLaTeXHeader,
  generateLaTeXFooter,
  pageLayoutToCSS,
  type BibliographyEntry,
  type Citation as BibliographyCitation,
  type CitationStyle,
  type IndexEntry,
  type TOCEntry,
  type TOCOptions,
  type CrossReference,
  type ReferenceTarget,
  type Footnote,
  type MarginNote,
  type Sidebar,
  type PageLayout,
  type PageSize,
  type PageMargins,
  type PageOrientation,
  type Watermark,
  type WatermarkPreset,
  type PageHeader,
  type PageFooter,
  type BibliographyStyle,
} from "../publishing";

// Multi-format document export (Markdown, HTML, LaTeX, DOCX, PDF, JSON)
export {
  useExport,
  exportDocument,
  exportToMarkdown,
  exportToHTML,
  exportToLaTeX,
  exportToPlainText,
  exportToJSON,
  exportToDOCX,
  exportToPDF,
  calculateDocumentStats,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  type DocumentListItem,
} from "../export";

// FAR/DFARS compliance tracking and traceability
export {
  FAR_CLAUSES,
  DFARS_CLAUSES,
  ALL_CLAUSES,
  detectClauses,
  analyzeCompliance,
  exportTraceabilityMatrix,
  exportComplianceReport,
  useComplianceAnalyzer,
} from "../compliance";

// Presentation system (consulting themes, SCR storylines, pyramid principle)
export {
  usePresentations,
  MCKINSEY_THEME,
  BCG_THEME,
  BAIN_THEME,
  THEMES,
  buildSCRStoryline,
  validatePyramidPrinciple,
  type Slide,
  type SlideType,
  type Presentation,
  type PresentationTheme,
  type StorylineFramework,
  type ChartConfig,
  type ChartType,
  type ChartDataPoint,
  type ChartSeries,
  type ChartAnnotation,
  type TableConfig,
  type SCRAnalysis,
  type PyramidValidationResult,
} from "../presentations";

// Presentation formats (BCG, McKinsey, Bain, Deloitte, military briefs)
export {
  FORMAT_LIBRARY,
  BCG_FORMAT,
  MCKINSEY_FORMAT,
  BAIN_FORMAT,
  DELOITTE_FORMAT,
  MILITARY_DECISION_BRIEF,
  MILITARY_INFORMATION_BRIEF,
  MILITARY_CONOPS,
  MILITARY_STAFT,
  validateConsultingFormat,
  validateMilitaryFormat,
  generateBCGStoryline,
  generateMilitaryDecisionBrief,
  isActionTitle,
  type FormatType,
  type ConsultingFormat,
  type MilitaryFormatType,
  type ConsultingFirm,
  type FormatValidationResult,
} from "../presentation-formats";
