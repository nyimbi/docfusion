"use client";

/**
 * Backlinks Panel Component - DocFusion
 *
 * Displays all documents that link to the current document (backlinks).
 * Features:
 * - Shows linked documents with context snippets
 * - Displays count of backlinks
 * - Click to navigate to source document
 * - Empty state when no backlinks exist
 * - Loading skeleton state
 *
 * Inspired by Roam Research / Obsidian / Notion
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { BacklinkInfo } from "@/lib/hdsi/bidirectional-links";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import {
  Link as LinkIcon,
  ArrowUpRight,
  FileText,
  GitBranch,
  Search,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface BacklinksPanelProps {
  /** Current document ID */
  documentId: string;
  /** Current document title (for header display) */
  documentTitle: string;
  /** Array of backlinks from bidirectional-links.ts */
  backlinks: BacklinkInfo[];
  /** Callback when user clicks to navigate to a source document */
  onNavigateToDocument: (docId: string) => void;
  /** Whether backlinks are loading */
  isLoading?: boolean;
  /** Optional additional className */
  className?: string;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Backlinks panel showing all documents linking to the current document.
 *
 * Displays:
 * - Header with backlink icon and count
 * - List of linking documents with context snippets
 * - Click to navigate to source documents
 * - Empty state when no backlinks exist
 * - Loading skeleton state
 *
 * @example
 * <BacklinksPanel
 *   documentId="doc-123"
 *   documentTitle="Project Plan"
 *   backlinks={backlinks}
 *   onNavigateToDocument={(id) => router.push(`/docs/${id}`)}
 *   isLoading={false}
 * />
 */
export const BacklinksPanel = React.memo(function BacklinksPanel({
  documentId,
  documentTitle,
  backlinks,
  onNavigateToDocument,
  isLoading = false,
  className,
}: BacklinksPanelProps) {
  // Handle navigation to source document
  const handleNavigate = React.useCallback(
    (e: React.MouseEvent, backlink: BacklinkInfo) => {
      e.preventDefault();
      e.stopPropagation();
      onNavigateToDocument(backlink.documentId);
    },
    [onNavigateToDocument]
  );

  // Track if we have any backlinks
  const hasBacklinks = !isLoading && backlinks.length > 0;

  // Calculate total link count (sum of all linkCount values)
  const totalLinkCount = React.useMemo(
    () => backlinks.reduce((sum, b) => sum + b.linkCount, 0),
    [backlinks]
  );

  return (
    <Card
      variant="default"
      className={cn(
        "flex flex-col h-full overflow-hidden bg-card text-card-foreground",
        className
      )}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="font-semibold text-sm">Backlinks</h3>
          {!isLoading && hasBacklinks && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {backlinks.length} doc{backlinks.length !== 1 ? "s" : ""}
              {totalLinkCount > backlinks.length && (
                <span className="text-muted-foreground ml-1">
                  ({totalLinkCount} refs)
                </span>
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Panel content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Loading state */}
          {isLoading && <BacklinksSkeleton />}

          {/* Empty state */}
          {!isLoading && backlinks.length === 0 && (
            <BacklinksEmptyState documentTitle={documentTitle} />
          )}

          {/* Backlinks list */}
          {!isLoading && hasBacklinks && (
	            <ul className="space-y-2" aria-label="Backlinks">
              {backlinks.map((backlink) => (
                <BacklinksListItem
                  key={backlink.documentId}
                  backlink={backlink}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>

      {/* Footer with stats */}
      {hasBacklinks && totalLinkCount > 0 && (
        <div className="px-4 py-2 border-t text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center justify-between">
            <span>
              {totalLinkCount} reference{totalLinkCount !== 1 ? "s" : ""} from{" "}
              {backlinks.length} document{backlinks.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
});

BacklinksPanel.displayName = "BacklinksPanel";

// ============================================================================
// Sub-components
// ============================================================================

interface BacklinksListItemProps {
  backlink: BacklinkInfo;
  onNavigate: (e: React.MouseEvent, backlink: BacklinkInfo) => void;
}

/**
 * Individual backlink item.
 * Shows document title, context snippet, and link count.
 */
function BacklinksListItem({ backlink, onNavigate }: BacklinksListItemProps) {
  // Get document title from backlink (truncate if too long)
  const displayTitle = React.useMemo(() => {
    if (backlink.documentTitle.length > 60) {
      return backlink.documentTitle.slice(0, 57) + "...";
    }
    return backlink.documentTitle;
  }, [backlink.documentTitle]);

  // Get context snippet (truncate if too long, clean up formatting)
  const displayContext = React.useMemo(() => {
    let snippet = backlink.contextSnippet;
    if (snippet.length > 120) {
      snippet = snippet.slice(0, 117) + "...";
    }
    // Clean up excessive whitespace
    return snippet.replace(/\s+/g, " ").trim();
  }, [backlink.contextSnippet]);

  return (
    <li>
      <button
        onClick={(e) => onNavigate(e, backlink)}
        className={cn(
          "w-full text-left group relative",
          "rounded-lg border bg-card",
          "p-3 transition-all duration-200",
          "hover:border-border-strong hover:bg-accent/50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label={`Navigate to ${backlink.documentTitle}`}
      >
        {/* Document title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            <span className="font-medium text-sm text-foreground truncate">
              {displayTitle}
            </span>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        </div>

        {/* Context snippet */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
          {displayContext}
        </p>

        {/* Link count badge if more than 1 */}
        {backlink.linkCount > 1 && (
          <div className="flex justify-end">
            <Badge variant="outline" className="text-[10px] px-1.5 h-4">
              {backlink.linkCount} links
            </Badge>
          </div>
        )}
      </button>
    </li>
  );
}

interface BacklinksEmptyStateProps {
  documentTitle: string;
}

/**
 * Empty state when no backlinks exist.
 * Shows friendly message and icon.
 */
function BacklinksEmptyState({ documentTitle }: BacklinksEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 px-4 text-center"
      role="status"
      aria-label="No backlinks found"
    >
      {/* Icon */}
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur-xl" />
        <div className="relative w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
          <LinkIcon className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-foreground mb-1">
        No backlinks yet
      </h4>

      {/* Description */}
      <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
        No other documents link to <strong>{documentTitle}</strong>.
        Create links with <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono">[[{documentTitle}]]</code>
        in other documents to link back here.
      </p>
    </div>
  );
}

/**
 * Loading skeleton for backlinks panel.
 * Shows during data fetching.
 */
function BacklinksSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading backlinks">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-lg border bg-card p-3 animate-pulse"
        >
          {/* Title row */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-4 rounded bg-muted flex-shrink-0" />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </div>
          {/* Context lines */}
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded bg-muted/60" />
            <div className="h-3 w-2/3 rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default BacklinksPanel;
