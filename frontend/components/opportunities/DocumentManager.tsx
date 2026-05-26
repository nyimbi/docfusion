"use client";

/**
 * Document Manager Component
 * 
 * Displays discovered RFP documents with checkboxes for selection.
 * Allows downloading selected documents and viewing download status.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, 
  FileSpreadsheet, 
  FileArchive, 
  Download, 
  RefreshCw, 
  ExternalLink,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  FolderOpen,
  File,
  Brain,
  Search,
  Globe,
  Archive,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  discoverOpportunityDocuments,
  getOpportunityDocumentsAction,
  downloadOpportunityDocument,
  downloadSelectedOpportunityDocuments,
  toggleDocumentSelection,
  toggleAllDocumentSelections,
  deleteOpportunityDocument,
} from "@/lib/actions/opportunity-documents";

// ============================================================================
// Types
// ============================================================================

type DocumentStatus = "discovered" | "downloading" | "downloaded" | "failed" | "analyzed" | "error";
type DocumentType = "rfp" | "amendment" | "attachment" | "specification" | "evaluation" | "form" | "other";

interface OpportunityDocument {
  id: string;
  documentName: string;
  documentType: DocumentType;
  description: string | null;
  sourceUrl: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  status: DocumentStatus;
  isSelected: boolean;
  downloadAttempts: number;
  lastError: string | null;
  discoveredAt: Date;
  downloadedAt: Date | null;
}

interface IntakeResult {
  documentId?: string;
  rfpDocumentId?: string;
  parsingJobId?: string;
  storagePath?: string;
  error?: string;
  success: boolean;
}

interface DocumentManagerProps {
  opportunityId: string;
  sourceUrl: string | null;
  documentsDiscovered: boolean;
  initialDocuments: OpportunityDocument[];
}

// ============================================================================
// Component
// ============================================================================

export function DocumentManager({
  opportunityId,
  sourceUrl,
  documentsDiscovered,
  initialDocuments,
}: DocumentManagerProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<OpportunityDocument[]>(initialDocuments);
  const [hasDiscoveredDocuments, setHasDiscoveredDocuments] = useState(documentsDiscovered);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [lastIntakeResults, setLastIntakeResults] = useState<IntakeResult[]>([]);

  // Calculate stats
  const discoveredCount = documents.length;
  const downloadedCount = documents.filter((d) => d.status === "downloaded").length;
  const selectedCount = documents.filter((d) => d.isSelected).length;
  const allSelected = documents.length > 0 && documents.every((d) => d.isSelected);

  // ============================================================================
  // Discovery
  // ============================================================================

  const [discoveryAnalysis, setDiscoveryAnalysis] = useState<string>("");

  const refreshDocumentsFromServer = useCallback(async () => {
    const result = await getOpportunityDocumentsAction(opportunityId);
    if (result.success && result.documents) {
      setDocuments(result.documents as OpportunityDocument[]);
      setHasDiscoveredDocuments(result.documents.length > 0);
    }
    router.refresh();
  }, [opportunityId, router]);

  const handleDiscover = useCallback(async () => {
    setIsDiscovering(true);
    toast.loading("AI Agent is searching for RFP documents across multiple sources...", { 
      id: "discover",
      duration: 60000, // Longer duration for AI search
    });

    try {
      const result = await discoverOpportunityDocuments(opportunityId);

      if (result.success) {
        setDiscoveryAnalysis(result.aiAnalysis || "");
        toast.success(
          `AI Agent found ${result.documents.length} documents using ${result.strategiesSucceeded.length} strategies`, 
          { id: "discover" }
        );
        await refreshDocumentsFromServer();
      } else {
        const strategyMsg = result.strategiesAttempted.length > 0 
          ? ` (tried ${result.strategiesAttempted.length} strategies)`
          : "";
        toast.error((result.error || "Discovery failed") + strategyMsg, { id: "discover" });
      }
    } catch (error) {
      toast.error("Discovery failed unexpectedly", { id: "discover" });
    } finally {
      setIsDiscovering(false);
    }
  }, [opportunityId, refreshDocumentsFromServer]);

  // ============================================================================
  // Selection
  // ============================================================================

  const handleToggleAll = useCallback(async () => {
    const newValue = !allSelected;
    
    // Optimistic update
    setDocuments((prev) =>
      prev.map((doc) => ({ ...doc, isSelected: newValue }))
    );

    const result = await toggleAllDocumentSelections(opportunityId, newValue);

    if (!result.success) {
      toast.error(result.error || "Failed to update selection");
      // Revert on failure
      setDocuments((prev) =>
        prev.map((doc) => ({ ...doc, isSelected: !newValue }))
      );
    }
  }, [allSelected, opportunityId]);

  const handleToggleSelection = useCallback(async (documentId: string, checked: boolean) => {
    // Optimistic update
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId ? { ...doc, isSelected: checked } : doc
      )
    );

    const result = await toggleDocumentSelection(documentId, checked);

    if (!result.success) {
      toast.error(result.error || "Failed to update selection");
      // Revert on failure
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId ? { ...doc, isSelected: !checked } : doc
        )
      );
    }
  }, []);

  // ============================================================================
  // Download
  // ============================================================================

  const handleDownloadOne = useCallback(async (documentId: string) => {
    setDownloadingIds((prev) => new Set(prev).add(documentId));

    try {
      const result = await downloadOpportunityDocument(opportunityId, documentId);

      if (result.success) {
        toast.success(result.parsingJobId ? "RFP ingested and parser queued" : `Downloaded: ${result.documentId}`);
        setLastIntakeResults([{
          success: true,
          documentId: result.documentId,
          rfpDocumentId: result.rfpDocumentId,
          parsingJobId: result.parsingJobId,
          storagePath: result.storagePath,
        }]);
        // Update local state
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? { ...doc, status: "downloaded" }
              : doc
          )
        );
        router.refresh();
      } else {
        toast.error(result.error || "Download failed");
        // Update status to failed
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? { ...doc, status: "failed" }
              : doc
          )
        );
      }
    } catch (error) {
      toast.error("Download failed unexpectedly");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  }, [opportunityId, router]);

  const handleDownloadSelected = useCallback(async () => {
    const selectedDocs = documents.filter((d) => d.isSelected && d.status === "discovered");
    
    if (selectedDocs.length === 0) {
      toast.info("No documents selected for download");
      return;
    }

    setIsDownloading(true);
    toast.loading(`Ingesting ${selectedDocs.length} document${selectedDocs.length === 1 ? "" : "s"}...`, { id: "bulk-download" });

    try {
      const result = await downloadSelectedOpportunityDocuments(opportunityId);

      if (result.success) {
        toast.success(
          `Ingested ${result.downloaded} document${result.downloaded === 1 ? "" : "s"}${result.failed > 0 ? `, ${result.failed} failed` : ""}`,
          { id: "bulk-download" }
        );
        setLastIntakeResults(result.results.map((item) => ({
          success: item.success,
          documentId: item.documentId,
          rfpDocumentId: item.rfpDocumentId,
          parsingJobId: item.parsingJobId,
          storagePath: item.storagePath,
          error: item.error,
        })));
        const succeeded = new Set(result.results.filter((item) => item.success).map((item) => item.documentId));
        const failed = new Set(result.results.filter((item) => !item.success).map((item) => item.documentId));
        setDocuments((prev) => prev.map((doc) => {
          if (succeeded.has(doc.id)) return { ...doc, status: "downloaded" };
          if (failed.has(doc.id)) return { ...doc, status: "failed" };
          return doc;
        }));
        router.refresh();
      } else {
        toast.error(result.error || "Bulk download failed", { id: "bulk-download" });
      }
    } catch (error) {
      toast.error("Download failed unexpectedly", { id: "bulk-download" });
    } finally {
      setIsDownloading(false);
    }
  }, [documents, opportunityId, router]);

  // ============================================================================
  // Delete
  // ============================================================================

  const handleDelete = useCallback(async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    const result = await deleteOpportunityDocument(opportunityId, documentId);

    if (result.success) {
      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      router.refresh();
    } else {
      toast.error(result.error || "Delete failed");
    }
  }, [opportunityId, router]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!hasDiscoveredDocuments || documents.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-muted/30">
        <div className="text-center space-y-4">
          <div className="flex justify-center gap-2">
            <Brain className="h-10 w-10 text-primary" />
            <Sparkles className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-medium">AI Document Discovery Agent</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              The AI agent will search multiple sources to find your RFP documents:
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background text-xs">
                <Search className="h-3 w-3" /> Primary Portal
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background text-xs">
                <Globe className="h-3 w-3" /> Web Search
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background text-xs">
                <ExternalLink className="h-3 w-3" /> Alternative Sources
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background text-xs">
                <Archive className="h-3 w-3" /> Archives
              </span>
            </div>
          </div>
          <Button
            onClick={handleDiscover}
            disabled={isDiscovering}
            className="gap-2"
            variant="primary"
          >
            {isDiscovering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            {isDiscovering ? "AI Agent Searching..." : "Start AI Discovery"}
          </Button>
          {isDiscovering && (
            <p className="text-xs text-muted-foreground">
              The AI is analyzing the opportunity and searching across multiple sources...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Discovery Info */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm">
          <span className="font-medium">AI Agent</span> found these documents using intelligent search
        </span>
      </div>

      <RfpIntakeSteps
        discoveredCount={discoveredCount}
        selectedCount={selectedCount}
        downloadedCount={downloadedCount}
        lastResults={lastIntakeResults}
      />

      {/* Header with stats and actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span>{discoveredCount} documents found</span>
          </div>
          {downloadedCount > 0 && (
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-4 w-4" />
              <span>{downloadedCount} downloaded</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscover}
            disabled={isDiscovering}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-4 w-4", isDiscovering && "animate-spin")} />
            <span className="hidden sm:inline">Re-scan</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadSelected}
            disabled={isDownloading || selectedCount === 0}
            className="gap-1.5"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Ingest Selected ({selectedCount})
          </Button>
        </div>
      </div>

      {/* Select all checkbox */}
      <div className="flex items-center gap-2 py-2 border-b">
        <Checkbox
          id="select-all"
          checked={allSelected}
          onCheckedChange={handleToggleAll}
        />
        <label
          htmlFor="select-all"
          className="text-sm font-medium cursor-pointer"
        >
          Select All
        </label>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {documents.map((doc) => (
          <DocumentItem
            key={doc.id}
            document={doc}
            opportunityId={opportunityId}
            isDownloading={downloadingIds.has(doc.id)}
            onToggleSelection={handleToggleSelection}
            onDownload={handleDownloadOne}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

function RfpIntakeSteps({
  discoveredCount,
  selectedCount,
  downloadedCount,
  lastResults,
}: {
  discoveredCount: number;
  selectedCount: number;
  downloadedCount: number;
  lastResults: IntakeResult[];
}) {
  const queued = lastResults.filter((result) => result.parsingJobId).length;
  const stored = lastResults.filter((result) => result.storagePath).length;

  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-3 text-xs sm:grid-cols-4">
      <IntakeStep label="Discover" value={`${discoveredCount} found`} active={discoveredCount > 0} />
      <IntakeStep label="Select" value={`${selectedCount} selected`} active={selectedCount > 0} />
      <IntakeStep label="Store" value={stored > 0 ? `${stored} stored` : `${downloadedCount} ready`} active={downloadedCount > 0 || stored > 0} />
      <IntakeStep label="Parse" value={queued > 0 ? `${queued} queued` : "awaiting ingest"} active={queued > 0} />
    </div>
  );
}

function IntakeStep({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className={cn("h-4 w-4", active ? "text-green-600" : "text-muted-foreground")} />
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        <div className="truncate text-muted-foreground">{value}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Document Item Component
// ============================================================================

interface DocumentItemProps {
  document: OpportunityDocument;
  opportunityId: string;
  isDownloading: boolean;
  onToggleSelection: (id: string, checked: boolean) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

function DocumentItem({
  document,
  opportunityId,
  isDownloading,
  onToggleSelection,
  onDownload,
  onDelete,
}: DocumentItemProps) {
  const [showError, setShowError] = useState(false);

  const typeIcon = getTypeIcon(document.documentType);
  const statusBadge = getStatusBadge(document.status, document.fileSizeBytes);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        document.isSelected && "bg-primary/5 border-primary/20",
        document.status === "failed" && "border-destructive/30 bg-destructive/5"
      )}
    >
      <Checkbox
        id={`doc-${document.id}`}
        checked={document.isSelected}
        onCheckedChange={(checked) => onToggleSelection(document.id, checked as boolean)}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="shrink-0 mt-0.5">{typeIcon}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <label
                htmlFor={`doc-${document.id}`}
                className="font-medium text-sm cursor-pointer truncate"
              >
                {document.documentName}
              </label>
              {statusBadge}
            </div>

            {document.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {document.description}
              </p>
            )}

            {/* Error message */}
            {document.status === "failed" && document.lastError && showError && (
              <p className="text-xs text-destructive mt-1">
                {document.lastError}
              </p>
            )}

            {/* Footer with meta info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="uppercase">{document.documentType}</span>
              {document.fileSizeBytes && (
                <span>{formatFileSize(document.fileSizeBytes)}</span>
              )}
              {document.downloadAttempts > 0 && document.status !== "downloaded" && (
                <span>{document.downloadAttempts} attempt(s)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* View source link */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          asChild
        >
          <a
            href={document.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View source"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>

        {/* Download button */}
        {document.status !== "downloaded" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDownload(document.id)}
            disabled={isDownloading || document.status === "downloading"}
            title="Download"
          >
            {isDownloading || document.status === "downloading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Downloaded - show link to file */}
        {document.status === "downloaded" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600"
            asChild
          >
            <a
              href={`/api/v1/opportunities/${opportunityId}/documents/${document.id}/download`}
              title="Open downloaded file"
            >
              <Check className="h-4 w-4" />
            </a>
          </Button>
        )}

        {/* Error indicator */}
        {document.status === "failed" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => setShowError(!showError)}
            title="Show error"
          >
            <AlertCircle className="h-4 w-4" />
          </Button>
        )}

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(document.id)}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: DocumentType) {
  const className = "h-5 w-5 text-muted-foreground";

  switch (type) {
    case "rfp":
      return <FileText className={cn(className, "text-blue-500")} />;
    case "specification":
      return <FileText className={cn(className, "text-purple-500")} />;
    case "evaluation":
      return <FileSpreadsheet className={cn(className, "text-green-500")} />;
    case "form":
      return <File className={cn(className, "text-amber-500")} />;
    case "amendment":
      return <FileText className={cn(className, "text-orange-500")} />;
    default:
      return <FileArchive className={className} />;
  }
}

function getStatusBadge(status: DocumentStatus, fileSize: number | null) {
  switch (status) {
    case "downloaded":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
          <Check className="h-3 w-3 mr-1" />
          Downloaded
        </span>
      );
    case "downloading":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Downloading
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </span>
      );
    case "analyzed":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
          Analyzed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
          Discovered
        </span>
      );
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
