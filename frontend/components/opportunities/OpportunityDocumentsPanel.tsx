"use client";

/**
 * Opportunity Documents Panel
 * 
 * Integrated component for the opportunity detail page.
 * Shows discovered RFP documents, download status, and allows
 * triggering AI document discovery.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RFPParseProgress } from "@/components/rfp/RFPParseProgress";
import { 
  FileText, 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  Brain,
  Search,
  FolderOpen,
  File,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  discoverOpportunityDocuments,
  downloadOpportunityDocument,
  downloadSelectedOpportunityDocuments,
  ingestOpportunitySourceDocument,
  toggleDocumentSelection,
  toggleAllDocumentSelections,
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
  extractedText: string | null;
  pageCount: number | null;
  rfpDocumentId?: string | null;
  parsingJobId?: string | null;
  parsingStatus?: string | null;
  parsingProgress?: number | null;
}

interface IntakeResult {
  documentId?: string;
  rfpDocumentId?: string;
  parsingJobId?: string;
  storagePath?: string;
  error?: string;
  success: boolean;
}

interface OpportunityDocumentsPanelProps {
  opportunityId: string;
  opportunityTitle: string;
  sourceUrl?: string | null;
  documentsDiscovered: boolean;
  initialDocuments: OpportunityDocument[];
}

// ============================================================================
// Component
// ============================================================================

export function OpportunityDocumentsPanel({
  opportunityId,
  opportunityTitle,
  sourceUrl,
  documentsDiscovered,
  initialDocuments,
}: OpportunityDocumentsPanelProps) {
  const [documents, setDocuments] = useState<OpportunityDocument[]>(initialDocuments);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSourceIngesting, setIsSourceIngesting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [discoveryAnalysis, setDiscoveryAnalysis] = useState<string>("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [lastIntakeResults, setLastIntakeResults] = useState<IntakeResult[]>([]);

  // Calculate stats
  const discoveredCount = documents.length;
  const downloadedCount = documents.filter((d) => d.status === "downloaded").length;
  const extractedCount = documents.filter((d) => d.extractedText).length;
  const selectedCount = documents.filter((d) => d.isSelected).length;
  const allSelected = documents.length > 0 && documents.every((d) => d.isSelected);
  const visibleRfpDocumentIds = Array.from(new Set([
    ...documents
      .map((document) => document.rfpDocumentId)
      .filter((id): id is string => Boolean(id)),
    ...lastIntakeResults
      .map((result) => result.rfpDocumentId)
      .filter((id): id is string => Boolean(id)),
  ]));
  const freshIntakeRfpDocumentIds = new Set(
    lastIntakeResults
      .map((result) => result.rfpDocumentId)
      .filter((id): id is string => Boolean(id))
  );
  const parseProgressPanel = visibleRfpDocumentIds.length > 0 ? (
    <div className="mt-3 space-y-3">
      {visibleRfpDocumentIds.map((rfpDocumentId) => {
        const isFreshIntake = freshIntakeRfpDocumentIds.has(rfpDocumentId);
        return (
          <RFPParseProgress
            key={rfpDocumentId}
            rfpDocumentId={rfpDocumentId}
            pollInterval={5000}
            onComplete={isFreshIntake
              ? (requirementsCount) => {
                toast.success(
                  requirementsCount > 0
                    ? `RFP parsing completed with ${requirementsCount} requirements`
                    : "RFP parsing completed"
                );
              }
              : undefined}
            onError={isFreshIntake ? (message) => toast.error(`RFP parsing failed: ${message}`) : undefined}
          />
        );
      })}
    </div>
  ) : null;

  // ============================================================================
  // Discovery
  // ============================================================================

  const handleDiscover = useCallback(async () => {
    setIsDiscovering(true);
    toast.loading("AI Agent is searching for RFP documents across multiple sources...", { 
      id: "discover",
      duration: 120000,
    });

    try {
      const result = await discoverOpportunityDocuments(opportunityId);

      if (result.success) {
        setDiscoveryAnalysis(result.aiAnalysis || "");
        toast.success(
          `AI Agent found ${result.documents.length} documents using ${result.strategiesSucceeded.length} strategies`, 
          { id: "discover" }
        );
        // Refresh page to get updated documents
        window.location.reload();
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
  }, [opportunityId]);

  const handleIngestSource = useCallback(async () => {
    setIsSourceIngesting(true);
    toast.loading("Ingesting source document and queuing parser...", {
      id: "source-ingest",
      duration: 120000,
    });

    try {
      const result = await ingestOpportunitySourceDocument(opportunityId);
      if (result.success) {
        toast.success(
          result.parsingJobId
            ? "Source document ingested and parser queued"
            : "Source document ingested",
          { id: "source-ingest" }
        );
        setLastIntakeResults([{
          success: true,
          documentId: result.documentId,
          rfpDocumentId: result.rfpDocumentId,
          parsingJobId: result.parsingJobId,
          storagePath: result.storagePath,
        }]);
      } else {
        toast.error(result.error || "Source document ingest failed", { id: "source-ingest" });
      }
    } catch {
      toast.error("Source document ingest failed unexpectedly", { id: "source-ingest" });
    } finally {
      setIsSourceIngesting(false);
    }
  }, [opportunityId]);

  // ============================================================================
  // Selection
  // ============================================================================

  const handleToggleAll = useCallback(async () => {
    const newValue = !allSelected;
    setDocuments((prev) => prev.map((doc) => ({ ...doc, isSelected: newValue })));

    const result = await toggleAllDocumentSelections(opportunityId, newValue);
    if (!result.success) {
      toast.error(result.error || "Failed to update selection");
      setDocuments((prev) => prev.map((doc) => ({ ...doc, isSelected: !newValue })));
    }
  }, [allSelected, opportunityId]);

  const handleToggleSelection = useCallback(async (documentId: string, checked: boolean) => {
    setDocuments((prev) => prev.map((doc) =>
      doc.id === documentId ? { ...doc, isSelected: checked } : doc
    ));

    const result = await toggleDocumentSelection(documentId, checked);
    if (!result.success) {
      toast.error(result.error || "Failed to update selection");
      setDocuments((prev) => prev.map((doc) =>
        doc.id === documentId ? { ...doc, isSelected: !checked } : doc
      ));
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
        setDocuments((prev) => prev.map((doc) =>
          doc.id === documentId ? { ...doc, status: "downloaded" } : doc
        ));
      } else {
        toast.error(result.error || "Download failed");
        setDocuments((prev) => prev.map((doc) =>
          doc.id === documentId ? { ...doc, status: "failed" } : doc
        ));
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
  }, [opportunityId]);

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
      } else {
        toast.error(result.error || "Bulk download failed", { id: "bulk-download" });
      }
    } catch (error) {
      toast.error("Download failed unexpectedly", { id: "bulk-download" });
    } finally {
      setIsDownloading(false);
    }
  }, [documents, opportunityId]);

  // ============================================================================
  // Render - Empty State
  // ============================================================================

  if (!documentsDiscovered || documents.length === 0) {
    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              RFP Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center gap-2">
                <Brain className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">AI Document Discovery</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The AI agent will search multiple sources to find your RFP documents
                </p>
              </div>
              <Button
                onClick={handleDiscover}
                disabled={isDiscovering || isSourceIngesting}
                className="gap-2"
                variant="primary"
              >
                {isDiscovering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                {isDiscovering ? "AI Searching..." : "Discover Documents"}
              </Button>
              {sourceUrl && (
                <Button
                  onClick={handleIngestSource}
                  disabled={isDiscovering || isSourceIngesting}
                  className="gap-2"
                  variant="outline"
                >
                  {isSourceIngesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isSourceIngesting ? "Ingesting..." : "Ingest Source Link"}
                </Button>
              )}
              {lastIntakeResults.length > 0 && (
                <div className="w-full pt-2">
                  <RfpIntakeSteps
                    discoveredCount={lastIntakeResults.length}
                    selectedCount={lastIntakeResults.length}
                    downloadedCount={lastIntakeResults.filter((result) => result.success).length}
                    lastResults={lastIntakeResults}
                  />
                </div>
              )}
              {isDiscovering && (
                <p className="text-xs text-muted-foreground">
                  Searching primary portal, web (SearXNG), alternative sources, archives...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        {parseProgressPanel}
      </>
    );
  }

  // ============================================================================
  // Render - Documents List
  // ============================================================================

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              RFP Documents
              {downloadedCount > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({downloadedCount}/{discoveredCount} downloaded{extractedCount > 0 && `, ${extractedCount} extracted`})
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscover}
              disabled={isDiscovering}
              className="h-8 gap-1"
            >
              <RefreshCw className={cn("h-4 w-4", isDiscovering && "animate-spin")} />
              <span className="hidden sm:inline">Re-scan</span>
            </Button>
          </div>

          {/* AI Discovery Info */}
          {discoveryAnalysis && (
            <div className="mt-2">
              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Brain className="h-3 w-3" />
                AI Discovery Analysis
                {showAnalysis ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showAnalysis && (
                <pre className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-32">
                  {discoveryAnalysis}
                </pre>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <RfpIntakeSteps
            discoveredCount={discoveredCount}
            selectedCount={selectedCount}
            downloadedCount={downloadedCount}
            lastResults={lastIntakeResults}
          />

          {/* Bulk Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={handleToggleAll}
              />
              <label htmlFor="select-all" className="text-sm">
                Select All
              </label>
            </div>

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

          {/* Document List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {documents.map((doc) => (
              <DocumentItem
                key={doc.id}
                document={doc}
                opportunityId={opportunityId}
                isDownloading={downloadingIds.has(doc.id)}
                isExpanded={expandedDoc === doc.id}
                onToggleExpand={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                onToggleSelection={(checked) => handleToggleSelection(doc.id, checked)}
                onDownload={() => handleDownloadOne(doc.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      {parseProgressPanel}
    </>
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
  const stored = lastResults.filter((result) => result.storagePath).length;
  const queued = lastResults.filter((result) => result.parsingJobId).length;

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
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleSelection: (checked: boolean) => void;
  onDownload: () => void;
}

function DocumentItem({
  document,
  opportunityId,
  isDownloading,
  isExpanded,
  onToggleExpand,
  onToggleSelection,
  onDownload,
}: DocumentItemProps) {
  const typeIcon = getTypeIcon(document.documentType);
  const statusBadge = getStatusBadge(document.status);

  return (
    <div
      className={cn(
        "border rounded-lg p-3 transition-colors",
        document.isSelected && "bg-primary/5 border-primary/20",
        document.status === "failed" && "border-destructive/30 bg-destructive/5"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Checkbox
          id={`doc-${document.id}`}
          checked={document.isSelected}
          onCheckedChange={(checked) => onToggleSelection(checked as boolean)}
          className="mt-0.5"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {typeIcon}
            <span className="font-medium text-sm truncate">{document.documentName}</span>
            {statusBadge}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="uppercase">{document.documentType}</span>
            {document.fileSizeBytes && (
              <span>{formatFileSize(document.fileSizeBytes)}</span>
            )}
            {document.pageCount && (
              <span>{document.pageCount} pages</span>
            )}
            {document.downloadAttempts > 0 && document.status !== "downloaded" && (
              <span>{document.downloadAttempts} attempt(s)</span>
            )}
          </div>

          {/* Error message */}
          {document.status === "failed" && document.lastError && isExpanded && (
            <p className="text-xs text-destructive mt-2">{document.lastError}</p>
          )}

          {/* Extracted text preview */}
          {document.extractedText && isExpanded && (
            <div className="mt-3 p-2 bg-muted rounded text-xs">
              <p className="font-medium mb-1">Extracted Content Preview:</p>
              <p className="text-muted-foreground line-clamp-5">
                {document.extractedText.substring(0, 500)}...
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Expand/Collapse */}
          {(document.extractedText || document.lastError) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleExpand}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}

          {/* View source */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            asChild
          >
            <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>

          {/* Download */}
          {document.status !== "downloaded" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDownload}
              disabled={isDownloading || document.status === "downloading"}
            >
              {isDownloading || document.status === "downloading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600"
              asChild
            >
              <a href={`/api/v1/opportunities/${opportunityId}/documents/${document.id}/download`}>
                <Check className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: DocumentType) {
  const className = "h-4 w-4 text-muted-foreground shrink-0";

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
      return <File className={className} />;
  }
}

function getStatusBadge(status: DocumentStatus) {
  switch (status) {
    case "downloaded":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
          <Check className="h-3 w-3 mr-0.5" />
          Ready
        </span>
      );
    case "downloading":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
          <Loader2 className="h-3 w-3 mr-0.5 animate-spin" />
          Downloading
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
          <AlertCircle className="h-3 w-3 mr-0.5" />
          Failed
        </span>
      );
    case "analyzed":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
          Analyzed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
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
