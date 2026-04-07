"use client";

/**
 * Opportunity Header Actions - Client Component
 * 
 * Provides interactive features:
 * - Copy opportunity name to clipboard
 * - Discover and download RFP documents
 * - Navigate to requirements and proposal docs
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { 
  Copy, 
  Check, 
  Download, 
  FileText, 
  ExternalLink,
  Loader2,
  FolderSearch,
  FileStack,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DocumentManager } from "./DocumentManager";
import { discoverOpportunityDocuments } from "@/lib/actions/opportunity-documents";

interface OpportunityHeaderActionsProps {
  opportunityId: string;
  opportunityTitle: string;
  sourceUrl?: string | null;
  rfpLink?: string | null;
  documentsDiscovered?: boolean;
  documents?: Array<{
    id: string;
    documentName: string;
    documentType: string;
    description: string | null;
    sourceUrl: string;
    fileSizeBytes: number | null;
    mimeType: string | null;
    status: "discovered" | "downloading" | "downloaded" | "failed" | "analyzed" | "error";
    isSelected: boolean;
    downloadAttempts: number;
    lastError: string | null;
    discoveredAt: Date;
    downloadedAt: Date | null;
  }>;
}

export function OpportunityHeaderActions({
  opportunityId,
  opportunityTitle,
  sourceUrl,
  rfpLink,
  documentsDiscovered = false,
  documents = [],
}: OpportunityHeaderActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showDocumentManager, setShowDocumentManager] = useState(false);

  // Copy opportunity name to clipboard
  const handleCopyName = async () => {
    try {
      await navigator.clipboard.writeText(opportunityTitle);
      setCopied(true);
      toast.success("Opportunity name copied to clipboard");
      
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Discover documents from source URL
  const handleDiscoverDocuments = async () => {
    if (!sourceUrl) {
      toast.error("No source URL available for this opportunity");
      return;
    }

    setIsDiscovering(true);
    toast.loading("Discovering RFP documents...", { id: "discover" });

    try {
      const result = await discoverOpportunityDocuments(opportunityId, sourceUrl);

      if (result.success) {
        toast.success(`Found ${result.documents.length} documents`, { id: "discover" });
        setShowDocumentManager(true);
        // Refresh to show discovered documents
        window.location.reload();
      } else {
        toast.error(result.error || "Discovery failed", { id: "discover" });
      }
    } catch (error) {
      toast.error("Discovery failed unexpectedly", { id: "discover" });
    } finally {
      setIsDiscovering(false);
    }
  };

  const hasDocuments = documents.length > 0;
  const downloadedCount = documents.filter(d => d.status === "downloaded").length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Copy Title Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyName}
        className="gap-1.5"
        title="Copy opportunity name to clipboard"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="hidden sm:inline">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copy</span>
          </>
        )}
      </Button>

      {/* Get Requirements / Document Manager */}
      <Dialog open={showDocumentManager} onOpenChange={setShowDocumentManager}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            title={hasDocuments ? "Manage RFP documents" : "Discover RFP documents"}
          >
            {hasDocuments ? (
              <FileStack className="h-4 w-4" />
            ) : (
              <FolderSearch className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {hasDocuments 
                ? `Documents (${downloadedCount}/${documents.length})` 
                : "Get Requirements"}
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderSearch className="h-5 w-5" />
              RFP Document Manager
            </DialogTitle>
            <DialogDescription>
              Discover, download, and manage RFP documents and attachments
            </DialogDescription>
          </DialogHeader>
          
          <DocumentManager
            opportunityId={opportunityId}
            sourceUrl={sourceUrl || null}
            documentsDiscovered={documentsDiscovered}
            initialDocuments={documents.map(d => ({
              ...d,
              documentType: d.documentType as "rfp" | "amendment" | "attachment" | "specification" | "evaluation" | "form" | "other",
              status: d.status as "discovered" | "downloading" | "downloaded" | "failed" | "analyzed" | "error",
              discoveredAt: new Date(d.discoveredAt),
              downloadedAt: d.downloadedAt ? new Date(d.downloadedAt) : null,
            }))}
          />
        </DialogContent>
      </Dialog>

      {/* View RFP Direct Link (if available) */}
      {rfpLink && (
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-1.5"
        >
          <a 
            href={rfpLink} 
            target="_blank" 
            rel="noopener noreferrer"
            title="View RFP directly on source site"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">View RFP</span>
          </a>
        </Button>
      )}

      {/* Existing Navigation Buttons */}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/opportunities/${opportunityId}/requirements`}>
          Requirements
        </Link>
      </Button>
      <Button variant="primary" size="sm" asChild>
        <Link href={`/opportunities/${opportunityId}/documents`}>
          Proposal Docs
        </Link>
      </Button>
    </div>
  );
}
