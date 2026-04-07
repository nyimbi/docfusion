/**
 * HDSI Content Submodule
 *
 * Document organization, content parsing, templates,
 * bidirectional links, graph view, and text formatting.
 *
 * Dependency graph:
 *   content-parser        -> core/types
 *   document-organization -> core/db, core/types
 *   templates             -> core/types
 *   template-importer     -> templates
 *   bidirectional-links   -> document-organization, core/db
 *   graph-view            -> document-organization
 *   text-colors           -> (none)
 */

// Content-to-structure parser (Markdown, HTML, Tiptap JSON)
// Note: content-parser exports are consumed directly via @/lib/hdsi/content-parser

// Document organization (taxonomy, folders, smart views, filters)
export {
  useDocumentOrganization,
  useDocumentBrowser,
  SMART_VIEWS,
  DEFAULT_FOLDERS,
  createDocumentMetadata,
  matchesFilters,
  sortDocuments,
  groupDocuments,
  type DocumentMetadata,
  type DocumentType,
  type DocumentObjective,
  type DocumentStatus,
  type DocumentStage,
  type Folder,
  type DocumentView,
  type DocumentFilters,
  type SortOption,
  type GroupByOption,
} from "../document-organization";

// Document templates (FAR, DFARS, SBIR, SOW, etc.)
export {
  ALL_TEMPLATES,
  TEMPLATES_BY_CATEGORY,
  POPULAR_TEMPLATES,
  FAR_PROPOSAL_TEMPLATE,
  DFARS_CYBER_TEMPLATE,
  SBIR_PROPOSAL_TEMPLATE,
  COMMERCIAL_PROPOSAL_TEMPLATE,
  STATEMENT_OF_WORK_TEMPLATE,
  TECHNICAL_SPECIFICATION_TEMPLATE,
  convertTemplateToNodes,
  searchTemplates,
  getTemplateById,
  getSuggestedTemplates,
  type DocumentTemplate,
  type TemplateCategory,
  type TemplateNode,
} from "../templates";

// Bidirectional [[WikiLinks]] with autocomplete and backlinks
export {
  useBidirectionalLinks,
  parseBidirectionalLinks,
  detectPartialLink,
  generateLinkSuggestions,
  calculateBacklinks,
  getBacklinksForDocument,
  buildLinkGraph,
  insertLink,
  removeLink,
  LINK_EDITOR_COMMANDS,
  type BidirectionalLink,
  type LinkSuggestion,
  type BacklinkInfo,
  type LinkNode,
} from "../bidirectional-links";

// Force-directed graph visualization of document connections
export {
  useGraphView,
  buildDocumentGraph,
  getNodeUrl,
  getConnectedNodes,
  getNodeStats,
  DEFAULT_GRAPH_PHYSICS,
  type GraphNode,
  type GraphLink,
  type GraphData,
  type GraphFilters,
  type GraphViewState,
} from "../graph-view";

// Text colors and semantic highlighting
export {
  useTextColors,
  getContrastRatio,
  isContrastValid,
  suggestTextColor,
  applySemanticColors,
  formatColorForDom,
  colorToCss,
  parseColorFromCss,
  colorsToMarkdown,
  colorsToLaTeX,
  COLOR_PRESETS,
  SEMANTIC_COLOR_RULES,
  type TextColor,
  type ColoredText,
  type ColorRule,
} from "../text-colors";
