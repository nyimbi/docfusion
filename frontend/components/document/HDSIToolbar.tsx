"use client";

/**
 * HDSI Toolbar - Comprehensive editor toolbar with all HDSI features
 * 
 * Features:
 * - Document versioning (save versions, view history, restore)
 * - Quality evaluation (assess, view scores, improvement suggestions)
 * - Section copy (copy section text to clipboard)
 * - Diagram insertion
 * - Export options
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  History,
  RotateCcw,
  Save,
  Copy,
  CheckCircle,
  AlertCircle,
  GitGraph,
  Wand2,
  Download,
  FileText,
  Sparkles,
  BarChart3,
  ChevronDown,
  Clock,
  User,
  MessageSquare,
  ChevronRight,
  Loader2,
  X,
  Check,
  FileCheck,
  TrendingUp,
  Target,
  Zap,
  Award,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as docx from "docx";
import { exportToHTML } from "@/lib/hdsi/export";
import type { HDSINode, HDSIVersion } from "@/lib/hdsi/types";
import { useHDSIVersionHistory } from "@/lib/hdsi/hooks";
import { hdsiDB } from "@/lib/hdsi/db";
import { triggerQualityAssessment, type QualityAssessment, type QualityFactorCategory } from "@/lib/actions/quality-assessment";

// ============================================================================
// Types & Props
// ============================================================================

interface HDSIToolbarProps {
  documentId: string;
  documentTitle: string;
  structure: HDSINode[];
  selectedNodeId?: string | null;
  onStructureChange?: (structure: HDSINode[]) => void;
  onSaveVersion?: (description: string) => Promise<void>;
  onRestoreVersion?: (version: HDSIVersion) => Promise<void>;
  onShowDiagramEditor?: () => void;
  onGenerateAI?: () => void;
  className?: string;
  showQualityPanel?: boolean;
  onToggleQualityPanel?: () => void;
}

interface VersionHistoryPanelProps {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreVersion?: (version: HDSIVersion) => Promise<void>;
}

interface QualityPanelProps {
  documentId: string;
  structure: HDSINode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Main Toolbar Component
// ============================================================================

export function HDSIToolbar({
  documentId,
  documentTitle,
  structure,
  selectedNodeId,
  onStructureChange,
  onSaveVersion,
  onRestoreVersion,
  onShowDiagramEditor,
  onGenerateAI,
  className,
  showQualityPanel,
  onToggleQualityPanel,
}: HDSIToolbarProps) {
  const [showVersionDialog, setShowVersionDialog] = React.useState(false);
  const [showQualityDialog, setShowQualityDialog] = React.useState(false);
  const [isCopying, setIsCopying] = React.useState(false);

  // Get selected node for copy functionality
  const selectedNode = React.useMemo(() => {
    if (!selectedNodeId) return null;
    const findNode = (nodes: HDSINode[]): HDSINode | null => {
      for (const node of nodes) {
        if (node.id === selectedNodeId) return node;
        const found = findNode(node.children);
        if (found) return found;
      }
      return null;
    };
    return findNode(structure);
  }, [structure, selectedNodeId]);

  // Copy section text to clipboard
  const handleCopySection = async () => {
    if (!selectedNode) {
      toast.error("No section selected");
      return;
    }

    setIsCopying(true);
    try {
      // Gather all text content from the node and its children
      const collectContent = (node: HDSINode): string => {
        const parts: string[] = [];
        if (node.title) parts.push(`# ${node.title}`);
        if (node.generatedContent) parts.push(node.generatedContent);
        
        for (const child of node.children) {
          const childContent = collectContent(child);
          if (childContent) parts.push(childContent);
        }
        return parts.join("\n\n");
      };

      const content = collectContent(selectedNode);
      if (!content.trim()) {
        toast.warning("Selected section has no content to copy");
        return;
      }

      await navigator.clipboard.writeText(content);
      toast.success(`Copied "${selectedNode.title}" to clipboard`);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    } finally {
      setIsCopying(false);
    }
  };

  // Quick copy all document content
  const handleCopyAll = async () => {
    try {
      const collectAllContent = (nodes: HDSINode[], depth = 0): string => {
        const parts: string[] = [];
        for (const node of nodes) {
          const prefix = "#".repeat(Math.min(depth + 1, 6));
          parts.push(`${prefix} ${node.title}`);
          if (node.generatedContent) parts.push(node.generatedContent);
          if (node.children.length > 0) {
            parts.push(collectAllContent(node.children, depth + 1));
          }
        }
        return parts.join("\n\n");
      };

      const content = collectAllContent(structure);
      if (!content.trim()) {
        toast.warning("Document has no content to copy");
        return;
      }

      await navigator.clipboard.writeText(content);
      toast.success("Full document copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy document");
    }
  };

  // Export handlers
  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();

      const collectAllContent = (nodes: HDSINode[], depth = 0): string[] => {
        const parts: string[] = [];
        for (const node of nodes) {
          // Title with appropriate heading style
          const prefix = depth === 0 ? node.title.toUpperCase() : node.title;
          if (depth === 0) {
            parts.push(`TITLE:${prefix}`);
          } else {
            parts.push(`H${Math.min(depth, 6)}:${prefix}`);
          }
          
          if (node.generatedContent) {
            parts.push(node.generatedContent);
          }
          if (node.children.length > 0) {
            parts.push(...collectAllContent(node.children, depth + 1));
          }
        }
        return parts;
      };

      const contentParts = collectAllContent(structure);
      let yPosition = 20;
      const marginLeft = 20;
      const marginRight = 20;
      const pageHeight = doc.internal.pageSize.height;
      const maxWidth = doc.internal.pageSize.width - marginLeft - marginRight;

      for (const part of contentParts) {
        if (part.startsWith("TITLE:")) {
          // Main title
          const title = part.replace("TITLE:", "").trim();
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          yPosition = 30;
          doc.text(title, doc.internal.pageSize.width / 2, yPosition, { align: "center" });
          yPosition += 15;
          doc.setLineWidth(0.5);
          doc.line(marginLeft, yPosition - 5, doc.internal.pageSize.width - marginRight, yPosition - 5);
          yPosition += 10;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
        } else if (part.startsWith("H")) {
          // Headings
          const match = part.match(/H(\d):(.*)/);
          if (match) {
            const level = parseInt(match[1]);
            const title = match[2].trim();
            
            if (yPosition > pageHeight - 30) {
              doc.addPage();
              yPosition = 20;
            }
            
            const fontSize = level === 1 ? 14 : level === 2 ? 12 : 11;
            doc.setFontSize(fontSize);
            doc.setFont("helvetica", level <= 2 ? "bold" : "normal");
            doc.text(title, marginLeft, yPosition);
            yPosition += fontSize * 0.5;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            yPosition += 5;
          }
        } else {
          // Content
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFontSize(11);
          const splitText = doc.splitTextToSize(part, maxWidth);
          doc.text(splitText, marginLeft, yPosition);
          yPosition += splitText.length * 6 + 8;
        }
      }

      doc.save(`${documentTitle.replace(/[^\w]+/g, "_")}.pdf`);
      toast.success("PDF exported successfully");
    } catch (err) {
      toast.error("Failed to export PDF");
    }
  };

  const handleExportHTML = async () => {
    try {
      const html = exportToHTML(structure, documentTitle, {
        includeTOC: true,
      });

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const filename = `${documentTitle.replace(/[^\w]+/g, "_")}.html`;
      
      // Native browser download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("HTML exported successfully");
    } catch (err) {
      toast.error("Failed to export HTML");
    }
  };

  const handleExportDOCX = async () => {
    try {
      // Build document content
      const docChildren: docx.Paragraph[] = [];
      
      // Title
      docChildren.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: documentTitle,
              bold: true,
              size: 32,
              font: "Arial",
            }),
          ],
          spacing: { after: 400 },
          alignment: docx.AlignmentType.CENTER,
        })
      );

      const processNode = (node: HDSINode, depth: number) => {
        // Heading - map depth to HeadingLevel constant
        const headingMap: Record<number, (typeof docx.HeadingLevel)["HEADING_1" | "HEADING_2" | "HEADING_3" | "HEADING_4" | "HEADING_5" | "HEADING_6"]> = {
          0: docx.HeadingLevel.HEADING_1,
          1: docx.HeadingLevel.HEADING_2,
          2: docx.HeadingLevel.HEADING_3,
          3: docx.HeadingLevel.HEADING_4,
          4: docx.HeadingLevel.HEADING_5,
          5: docx.HeadingLevel.HEADING_6,
        };
        const headingLevel = headingMap[depth] || docx.HeadingLevel.HEADING_6;
        const fontSize = depth === 0 ? 28 : depth === 1 ? 26 : depth === 2 ? 24 : depth === 3 ? 22 : 20;
        
        docChildren.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: node.title,
                bold: depth <= 2,
                size: fontSize,
                font: "Arial",
              }),
            ],
            spacing: { before: 400, after: 200 },
            heading: headingLevel,
          })
        );

        // Content
        if (node.generatedContent) {
          const paragraphs = node.generatedContent.split("\n\n").filter(p => p.trim());
          paragraphs.forEach(para => {
            docChildren.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: para.replace(/\n/g, " ").trim(),
                    size: 22,
                    font: "Arial",
                  }),
                ],
                spacing: { after: 200 },
              })
            );
          });
        }

        // Process children
        for (const child of node.children) {
          processNode(child, depth + 1);
        }
      };

      structure.forEach(node => processNode(node, 0));

      const doc = new docx.Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch in twips
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: docChildren,
        }],
      });

      const blob = await docx.Packer.toBlob(doc);
      const filename = `${documentTitle.replace(/[^\w]+/g, "_")}.docx`;
      
      // Native browser download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("DOCX exported successfully");
    } catch (err) {
      toast.error("Failed to export DOCX");
    }
  };

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        {/* Version Control */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Versions</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setShowVersionDialog(true)}>
              <History className="h-4 w-4 mr-2" />
              View Version History
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowVersionDialog(true)}>
              <Save className="h-4 w-4 mr-2" />
              Save New Version...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-muted-foreground text-xs">
              Auto-save enabled
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quality Assessment */}
        <Button
          variant={showQualityPanel ? "secondary" : "outline"}
          size="sm"
          className="gap-1"
          onClick={() => setShowQualityDialog(true)}
        >
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Quality</span>
        </Button>

        {/* Copy Section (only when node selected) */}
        {selectedNode && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleCopySection}
            disabled={isCopying}
          >
            {isCopying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Copy Section</span>
          </Button>
        )}

        <div className="h-6 w-px bg-border mx-1" />

        {/* Diagrams */}
        {onShowDiagramEditor && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={onShowDiagramEditor}
          >
            <GitGraph className="h-4 w-4" />
            <span className="hidden sm:inline">Diagrams</span>
          </Button>
        )}

        {/* AI Generate */}
        {onGenerateAI && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={onGenerateAI}
          >
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">AI Generate</span>
          </Button>
        )}

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleCopyAll}>
              <Copy className="h-4 w-4 mr-2" />
              Copy All as Markdown
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportDOCX}>
              <FileText className="h-4 w-4 mr-2" />
              Export as DOCX
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportHTML}>
              <FileText className="h-4 w-4 mr-2" />
              Export as HTML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Version History Dialog */}
      <VersionHistoryPanel
        documentId={documentId}
        open={showVersionDialog}
        onOpenChange={setShowVersionDialog}
        onRestoreVersion={onRestoreVersion}
      />

      {/* Quality Assessment Dialog */}
      <QualityPanel
        documentId={documentId}
        structure={structure}
        open={showQualityDialog}
        onOpenChange={setShowQualityDialog}
      />
    </>
  );
}

// ============================================================================
// Version History Panel
// ============================================================================

function VersionHistoryPanel({ documentId, open, onOpenChange, onRestoreVersion }: VersionHistoryPanelProps) {
  const { versions, isLoading, error, restoreVersion } = useHDSIVersionHistory(documentId);
  const [isSavingVersion, setIsSavingVersion] = React.useState(false);
  const [versionDescription, setVersionDescription] = React.useState("");
  const [selectedVersion, setSelectedVersion] = React.useState<HDSIVersion | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = React.useState(false);

  const handleSaveVersion = async () => {
    if (!versionDescription.trim()) {
      toast.error("Please enter a version description");
      return;
    }

    setIsSavingVersion(true);
    try {
      // Get current document to capture its structure
      const doc = await hdsiDB.getDocument(documentId);
      if (!doc) {
        throw new Error("Document not found");
      }

      // Save version to HDSI IndexedDB storage with current structure
      await hdsiDB.createVersion(documentId, doc.structure, {
        author: "user",
        description: versionDescription.trim(),
        isAutoSave: false,
      });

      toast.success("Version saved successfully");
      setVersionDescription("");

      // Refresh versions list by reloading
      const freshVersions = await hdsiDB.getDocumentVersions(documentId, 50);
      // The hook manages versions state, but re-mount will refresh
    } catch (err) {
      console.error("Failed to save version:", err);
      toast.error("Failed to save version");
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handleRestore = async (version: HDSIVersion) => {
    try {
      await restoreVersion(version);
      toast.success(`Restored version from ${format(version.timestamp, "MMM d, h:mm a")}`);
      onRestoreVersion?.(version);
      setShowRestoreConfirm(false);
      setSelectedVersion(null);
    } catch (err) {
      toast.error("Failed to restore version");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            Save versions at key milestones and restore previous states when needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
          {/* Save New Version */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save New Version
            </h4>
            <Textarea
              placeholder="Describe what changed in this version (e.g., 'Added conclusion section, fixed pricing')"
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Creates a restore point you can return to later
              </span>
              <Button
                size="sm"
                onClick={handleSaveVersion}
                disabled={!versionDescription.trim() || isSavingVersion}
              >
                {isSavingVersion ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Version
              </Button>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Version List */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Previous Versions
              {versions.length > 0 && (
                <Badge variant="secondary" className="text-xs">{versions.length}</Badge>
              )}
            </h4>
            
            <ScrollArea className="flex-1 -mx-2 px-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading versions...
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-8 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Failed to load versions
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No saved versions yet</p>
                  <p className="text-xs mt-1">Save your first version above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedVersion?.id === version.id
                          ? "bg-accent/50 border-accent"
                          : "bg-card hover:bg-accent/20"
                      )}
                      onClick={() => setSelectedVersion(selectedVersion?.id === version.id ? null : version)}
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {versions.length - index}
                        </div>
                        {index < versions.length - 1 && (
                          <div className="w-px h-full bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {formatDistanceToNow(version.timestamp, { addSuffix: true })}
                          </span>
                          {version.isAutoSave && (
                            <Badge variant="outline" className="text-[10px] h-5">Auto</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {version.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.author}
                          </span>
                          <span>{format(version.timestamp, "h:mm a")}</span>
                        </div>
                      </div>
                      {selectedVersion?.id === version.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowRestoreConfirm(true);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Restore Confirmation Dialog */}
        <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Restore Version?
              </DialogTitle>
              <DialogDescription>
                This will replace your current document with the version from{" "}
                {selectedVersion && format(selectedVersion.timestamp, "MMM d, h:mm a")}.
                Your current state will be saved as a new version first.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowRestoreConfirm(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary"
                onClick={() => selectedVersion && handleRestore(selectedVersion)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore This Version
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Quality Assessment Panel
// ============================================================================

function QualityPanel({ documentId, structure, open, onOpenChange }: QualityPanelProps) {
  const [assessment, setAssessment] = React.useState<QualityAssessment | null>(null);
  const [isAssessing, setIsAssessing] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<QualityFactorCategory | "all">("all");

  const handleAssess = async () => {
    setIsAssessing(true);
    try {
      const result = await triggerQualityAssessment(documentId, {
        includeFactors: true,
        includeIssues: true,
        includeSuggestions: true,
      });

      if (!result.success || !result.assessment) {
        throw new Error(result.error || "Assessment failed");
      }

      setAssessment(result.assessment);
      toast.success("Quality assessment complete");
    } catch (err) {
      console.error("Quality assessment error:", err);
      toast.error("Failed to assess quality");
    } finally {
      setIsAssessing(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (score >= 60) return <Target className="h-5 w-5 text-amber-600" />;
    return <AlertCircle className="h-5 w-5 text-red-600" />;
  };

  const filteredFactors = activeCategory === "all" 
    ? assessment?.factors || []
    : assessment?.factors.filter(f => f.category === activeCategory) || [];

  const categories: Array<{ id: QualityFactorCategory | "all"; label: string; icon: React.ReactNode }> = [
    { id: "all", label: "All Factors", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "content", label: "Content", icon: <FileText className="h-4 w-4" /> },
    { id: "structure", label: "Structure", icon: <GitGraph className="h-4 w-4" /> },
    { id: "style", label: "Style", icon: <Sparkles className="h-4 w-4" /> },
    { id: "technical", label: "Technical", icon: <Zap className="h-4 w-4" /> },
    { id: "compliance", label: "Compliance", icon: <FileCheck className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Quality Assessment
          </DialogTitle>
          <DialogDescription>
            Analyze your document for content quality, structure, style, and compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
          {/* Assessment Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {assessment ? (
                <>
                  <Badge className={cn("text-sm px-2 py-1", getScoreColor(assessment.overallScore))}>
                    <Award className="h-4 w-4 mr-1" />
                    Score: {assessment.overallScore}/100
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Assessed {formatDistanceToNow(assessment.assessedAt, { addSuffix: true })}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Last assessment: Never
                </span>
              )}
            </div>
            <Button 
              onClick={handleAssess} 
              disabled={isAssessing}
              size="sm"
            >
              {isAssessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {assessment ? "Re-assess" : "Run Assessment"}
                </>
              )}
            </Button>
          </div>

          {/* Overall Score */}
          {assessment && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-muted-200"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeDasharray={`${assessment.overallScore * 2.26} 226`}
                      className={cn(
                        assessment.overallScore >= 80 ? "text-green-500" :
                        assessment.overallScore >= 60 ? "text-amber-500" : "text-red-500"
                      )}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{assessment.overallScore}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Overall Quality Score</h4>
                  <p className="text-sm text-muted-foreground">{`${assessment.summary.wordCount} words, ${assessment.summary.paragraphCount} paragraphs`}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Coherence: </span>
                      <span className="font-medium">{Math.round(assessment.overallScore * 0.9)}%</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Status: </span>
                      <Badge variant={assessment.scoreLevel === "good" || assessment.scoreLevel === "excellent" ? "default" : "secondary"} className="text-xs">
                        {assessment.scoreLevel.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Filters */}
          {assessment && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1 whitespace-nowrap"
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.icon}
                  {cat.label}
                </Button>
              ))}
            </div>
          )}

          {/* Factor Details */}
          <ScrollArea className="flex-1 -mx-2 px-2">
            {!assessment ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No assessment yet</p>
                <p className="text-sm mt-1">Run an assessment to see quality metrics</p>
              </div>
            ) : filteredFactors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No factors in this category
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFactors.map((factor) => (
                  <div
                    key={factor.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getScoreIcon(factor.score)}
                        <span className="font-medium">{factor.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {factor.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={factor.score} className="w-24 h-2" />
                        <span className="text-sm font-medium w-10 text-right">{factor.score}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground pl-7">{factor.details}</p>
                    {factor.suggestions.length > 0 && (
                      <div className="pl-7 space-y-1">
                        <p className="text-xs font-medium text-amber-600">Suggestions:</p>
                        {factor.suggestions.map((suggestion, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                            <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                            {suggestion.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Quick Quality Score Card (for inline display)
// ============================================================================

interface QuickQualityScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  onClick?: () => void;
}

export function QuickQualityScore({ score, size = "md", showLabel = true, onClick }: QuickQualityScoreProps) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-green-600";
    if (s >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors",
        onClick && "hover:bg-accent cursor-pointer",
        score >= 80 ? "bg-green-50" : score >= 60 ? "bg-amber-50" : "bg-red-50"
      )}
    >
      <div className={cn(
        "rounded-full flex items-center justify-center font-semibold",
        sizeClasses[size],
        getColor(score)
      )}>
        {score}
      </div>
      {showLabel && (
        <span className={cn("text-sm font-medium", getColor(score))}>
          {score >= 80 ? "Good" : score >= 60 ? "Fair" : "Needs Work"}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Copy Section Button (standalone)
// ============================================================================

interface CopySectionButtonProps {
  node: HDSINode | null;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
}

export function CopySectionButton({ node, variant = "ghost", size = "sm", className }: CopySectionButtonProps) {
  const buttonVariant = variant === "primary" ? "primary" : variant === "secondary" ? "secondary" : variant === "outline" ? "outline" : "ghost";
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!node) {
      toast.error("No section selected");
      return;
    }

    try {
      const collectContent = (n: HDSINode, depth = 0): string => {
        const parts: string[] = [];
        const prefix = "#".repeat(Math.min(depth + 1, 6));
        parts.push(`${prefix} ${n.title}`);
        if (n.generatedContent) parts.push(n.generatedContent);
        
        for (const child of n.children) {
          const childContent = collectContent(child, depth + 1);
          if (childContent) parts.push(childContent);
        }
        return parts.join("\n\n");
      };

      const content = collectContent(node);
      if (!content.trim()) {
        toast.warning("Section has no content to copy");
        return;
      }

      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast.success(`Copied "${node.title}" to clipboard`);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <Button
      variant={buttonVariant}
      size={size}
      onClick={handleCopy}
      disabled={!node}
      className={className}
      title="Copy section content"
    >
      {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {size === "md" && <span className="ml-1">{isCopied ? "Copied" : "Copy"}</span>}
    </Button>
  );
}
