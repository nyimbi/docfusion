/**
 * Content Library Components Module
 *
 * Components for the semantic content library with AI-powered
 * search, suggestions, and win/loss analytics.
 */

// Main components
export { ContentLibraryBrowser } from "./ContentLibraryBrowser";
export { ContentSnippetCard } from "./ContentSnippetCard";
export type { ContentSnippet } from "./ContentSnippetCard";

// Editor and management
export { ContentBlockEditor } from "./ContentBlockEditor";
export { ContentBlockViewer } from "./ContentBlockViewer";

// Search and filters
export { SemanticSearchBar } from "./SemanticSearchBar";
export { ContentFilters } from "./ContentFilters";
export { ContentSuggestions } from "./ContentSuggestions";

// Tags and categorization
export { TagManager } from "./TagManager";

// Freshness and quality
export { FreshnessIndicator, FreshnessBadge, FreshnessProgress } from "./FreshnessIndicator";

// Analytics
export { ContentAnalytics } from "./ContentAnalytics";

// Import and insert
export { BulkImporter } from "./BulkImporter";
export { ContentInsertDialog } from "./ContentInsertDialog";

// Collections
export { CollectionManager } from "./CollectionManager";

// Workflow
export { ApprovalWorkflow, ApprovalStatusBadge } from "./ApprovalWorkflow";
