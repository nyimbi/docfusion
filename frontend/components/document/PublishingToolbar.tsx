"use client";

/**
 * Publishing Toolbar Component
 * 
 * Provides all publishing and document production controls:
 * - Bibliography and citations
 * - Table of Contents, Index, Cross-references
 * - Footnotes, Sidebars, Margin notes
 * - Page layout and formatting
 * - Watermarks
 * - Headers/Footers
 * - Document export (Markdown, PDF, Word, LaTeX)
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// Publishing system
import {
  usePublishing,
  BIBLIOGRAPHY_STYLES,
  WATERMARK_PRESETS,
  generateLaTeXHeader,
  generateLaTeXFooter,
  type CitationStyle,
  type BibliographyEntry,
  type PageLayout,
  type PageSize,
  type Watermark,
  type WatermarkPreset,
} from "@/lib/hdsi/publishing";
import { useExport, exportToHTML, exportToPDF, type ExportFormat } from "@/lib/hdsi/export";
import {
  MAX_RENDER_CONTENT_BYTES,
  describeRenderError,
  sanitizeRenderFilename,
  triggerBlobDownload,
} from "@/lib/document/server-export";
import { ExportPPTXButton } from "@/components/hdsi/ExportPPTXButton";
import type { HDSINode } from "@/lib/hdsi/types";

// Icons
import {
  BookOpen,
  Quote,
  List,
  Hash,
  Link2,
  Subscript,
  PanelLeft,
  PanelRight,
  FileText,
  Droplets,
  Layout,
  Printer,
  Download,
  Settings,
  Plus,
  ChevronDown,
  Type,
  Columns,
  Bookmark,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FoldVertical,
  Layers,
  FileDown,
  Loader2,
  FileCode,
  FileType,
  FileJson,
  Presentation,  // NEW: Presentation icon
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface PublishingToolbarProps {
  documentId: string;
  documentTitle: string;
  nodes: HDSINode[];
  onInsertCitation?: (entry: BibliographyEntry) => void;
  onGenerateTOC?: () => void;
  onGenerateIndex?: () => void;
  onAddFootnote?: () => void;
  onAddSidebar?: () => void;
  onAddMarginNote?: () => void;
  onUpdateLayout?: (layout: PageLayout) => void;
  onAddWatermark?: (preset: WatermarkPreset | Partial<Watermark>) => void;
  onCreatePresentation?: () => void;  // NEW: Create presentation callback
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function PublishingToolbar(props: PublishingToolbarProps) {
  const {
    documentId,
    documentTitle,
    nodes,
    onInsertCitation,
    onGenerateTOC,
    onGenerateIndex,
    onAddFootnote,
    onAddSidebar,
    onAddMarginNote,
    onUpdateLayout,
    onAddWatermark,
    onCreatePresentation,  // NEW
    className,
  } = props;

  const publishing = usePublishing(documentId);
  const exportSystem = useExport();

  const [showBibliography, setShowBibliography] = React.useState(false);
  const [showLayoutSettings, setShowLayoutSettings] = React.useState(false);
  const [showWatermarkSettings, setShowWatermarkSettings] = React.useState(false);

  // Tracks in-flight server-side renders so the export menu trigger can
  // show a spinner / disable correctly. The HDSI client-side hook tracks
  // its own state separately; we combine the two for the UI.
  const [serverExporting, setServerExporting] = React.useState(false);
  const isExporting = exportSystem.isExporting || serverExporting;

  // Quick citation insertion
  const handleQuickCite = (entry: BibliographyEntry) => {
    const citation = publishing.cite(entry.id, documentId);
    if (citation) {
      toast.success(`Citation inserted: ${citation}`);
      onInsertCitation?.(entry);
    }
  };

  // Client-side export — used for text-shaped outputs (markdown, latex,
  // html, txt, json) where the HDSI serializer produces the final
  // artifact directly and there is no value in round-tripping through
  // the backend renderer.
  const handleExport = async (format: ExportFormat) => {
    const options = {
      format,
      includeTOC: true,
      includeBibliography: publishing.entries.length > 0,
      pageLayout: publishing.pageLayout,
      watermarks: publishing.watermarks,
    };

    const result = await exportSystem.exportDoc(nodes, documentTitle, options);

    if (result.success) {
      toast.success(`Exported to ${format.toUpperCase()}: ${result.filename}`);
    } else {
      toast.error(`Export failed: ${result.error}`);
    }
  };

  // Server-side export — used for binary formats (PDF, DOCX) where the
  // backend DocumentEngine produces a higher-fidelity artifact than the
  // client can. The HDSI tree is serialized to HTML on the client (so
  // TOC, bibliography, watermarks, page layout still flow through) and
  // posted as content_override; the backend renders to the requested
  // binary format and streams the bytes back.
  //
  // Replaces the legacy client-side exportToDOCX path that produced
  // structurally invalid OOXML (audit C3 was the matching backend fix;
  // this PR closes the audit's remaining "two pipelines" gap).
  const handleServerExport = async (format: "pdf" | "docx") => {
    // Defensive early-return — the dropdown closes on click so two
    // concurrent invocations are hard to trigger, but a fast double-tap
    // could otherwise stack two in-flight requests.
    if (isExporting) return;

    setServerExporting(true);
    try {
      const html = exportToHTML(nodes, documentTitle, {
        includeTOC: true,
        pageLayout: publishing.pageLayout,
        watermarks: publishing.watermarks,
      });

      // Bound the request before it hits the network. The backend caps
      // content_override at the same byte count; a local error is more
      // actionable than the raw Pydantic 422 the server would surface.
      if (html.length > MAX_RENDER_CONTENT_BYTES) {
        toast.error(
          "Document is too large to export — split it or remove embedded assets.",
        );
        return;
      }

      const response = await fetch(
        `/api/v1/documents/${documentId}/render`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            output_format: format,
            content_override: html,
          }),
        },
      );

      if (!response.ok) {
        const upstreamText = await response.text().catch(() => "");
        throw new Error(describeRenderError(response, upstreamText));
      }

      const blob = await response.blob();
      triggerBlobDownload(blob, sanitizeRenderFilename(documentTitle, format));

      toast.success(`Exported to ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setServerExporting(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1 p-2 bg-muted/30 border-b", className)}>
      
      {/* Bibliography Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Bibliography</span>
            {publishing.usedCitations.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {publishing.usedCitations.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Citations & References</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => setShowBibliography(true)}>
            <BookOpen className="h-4 w-4 mr-2" />
            Manage Bibliography
          </DropdownMenuItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Quote className="h-4 w-4 mr-2" />
              Quick Cite
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {publishing.entries.length === 0 ? (
                <DropdownMenuItem disabled>
                  No entries in bibliography
                </DropdownMenuItem>
              ) : (
                publishing.entries.slice(0, 10).map(entry => (
                  <DropdownMenuItem 
                    key={entry.id}
                    onClick={() => handleQuickCite(entry)}
                  >
                    <span className="truncate text-xs">{entry.title}</span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowBibliography(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add New Reference...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Settings className="h-4 w-4 mr-2" />
              Citation Style
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {publishing.availableStyles.map(style => (
                <DropdownMenuItem 
                  key={style}
                  onClick={() => {
                    publishing.setActiveStyle(style);
                    toast.success(`Citation style: ${style.toUpperCase()}`);
                  }}
                  className={publishing.activeStyle === style ? "bg-accent" : ""}
                >
                  {style.toUpperCase()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => {
              const bib = publishing.generateBibliography();
              navigator.clipboard.writeText(bib);
              toast.success("Bibliography copied to clipboard");
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Copy Bibliography
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6" />

      {/* Insert Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Insert</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Document Elements</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={onGenerateTOC}>
            <List className="h-4 w-4 mr-2" />
            Table of Contents
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onGenerateIndex}>
            <Hash className="h-4 w-4 mr-2" />
            Index
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onAddFootnote}>
            <Subscript className="h-4 w-4 mr-2" />
            Footnote / Endnote
          </DropdownMenuItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Link2 className="h-4 w-4 mr-2" />
              Cross-Reference
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Figure...</DropdownMenuItem>
              <DropdownMenuItem>Table...</DropdownMenuItem>
              <DropdownMenuItem>Section...</DropdownMenuItem>
              <DropdownMenuItem>Page...</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onAddSidebar}>
            <PanelRight className="h-4 w-4 mr-2" />
            Sidebar
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onAddMarginNote}>
            <PanelLeft className="h-4 w-4 mr-2" />
            Margin Note
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* NEW: Create Presentation option */}
          <DropdownMenuItem onClick={onCreatePresentation}>
            <Presentation className="h-4 w-4 mr-2" />
            Create Presentation
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => onAddWatermark?.("draft")}>
            <Droplets className="h-4 w-4 mr-2" />
            Watermark
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6" />

      {/* Layout Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Layout</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Page Layout</DropdownMenuLabel>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileText className="h-4 w-4 mr-2" />
              Paper Size
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {["letter", "legal", "a4", "a5"].map(size => (
                <DropdownMenuItem 
                  key={size}
                  onClick={() => {
                    publishing.setPageLayout({ ...publishing.pageLayout, size: size as PageSize });
                    toast.success(`Paper size: ${size.toUpperCase()}`);
                  }}
                  className={publishing.pageLayout.size === size ? "bg-accent" : ""}
                >
                  {size.toUpperCase()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Columns className="h-4 w-4 mr-2" />
              Columns
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {[1, 2].map(cols => (
                <DropdownMenuItem 
                  key={cols}
                  onClick={() => {
                    publishing.setPageLayout({ ...publishing.pageLayout, columns: cols as 1 | 2 });
                    toast.success(`${cols} column${cols > 1 ? "s" : ""}`);
                  }}
                  className={publishing.pageLayout.columns === cols ? "bg-accent" : ""}
                >
                  {cols} Column{cols > 1 ? "s" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FoldVertical className="h-4 w-4 mr-2" />
              Line Spacing
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {[
                { label: "Single", value: 1 },
                { label: "1.5", value: 1.5 },
                { label: "Double", value: 2 },
              ].map(spacing => (
                <DropdownMenuItem 
                  key={spacing.value}
                  onClick={() => {
                    publishing.setPageLayout({ 
                      ...publishing.pageLayout, 
                      lineSpacing: spacing.value as 1 | 1.5 | 2 
                    });
                    toast.success(`Line spacing: ${spacing.label}`);
                  }}
                  className={publishing.pageLayout.lineSpacing === spacing.value ? "bg-accent" : ""}
                >
                  {spacing.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowLayoutSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Advanced Layout...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6" />

      {/* Watermark Quick Toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={publishing.watermarks.length > 0 ? "secondary" : "ghost"} 
            size="sm"
            className="gap-1"
          >
            <Droplets className="h-4 w-4" />
            <span className="hidden sm:inline">Watermark</span>
            {publishing.watermarks.length > 0 && (
              <Badge variant="outline" className="ml-1 text-xs">
                {publishing.watermarks.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Watermarks</DropdownMenuLabel>
          
          {Object.keys(WATERMARK_PRESETS).map(preset => (
            <DropdownMenuItem 
              key={preset}
              onClick={() => {
                publishing.addWatermark(preset as keyof typeof WATERMARK_PRESETS);
                toast.success(`${preset} watermark applied`);
              }}
            >
              <span className="capitalize">{preset}</span>
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowWatermarkSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Custom Watermark...
          </DropdownMenuItem>
          
          {publishing.watermarks.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => {
                  publishing.watermarks.forEach(w => publishing.removeWatermark(w.id));
                  toast.success("Watermarks removed");
                }}
                className="text-destructive"
              >
                Remove All
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {/* PowerPoint Export */}
      <ExportPPTXButton
        documentTitle={documentTitle}
        documentNodes={nodes}
        disabled={nodes.length === 0}
        size="sm"
        variant="secondary"
      />

      {/* Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1" disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Export Document</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleExport("markdown")}>
            <FileCode className="h-4 w-4 mr-2" />
            Markdown (.md)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleServerExport("docx")}>
            <FileType className="h-4 w-4 mr-2" />
            Word (.docx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("latex")}>
            <Type className="h-4 w-4 mr-2" />
            LaTeX (.tex)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleServerExport("pdf")}>
            <FileText className="h-4 w-4 mr-2" />
            PDF (.pdf)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExport("html")}>
            <FileJson className="h-4 w-4 mr-2" />
            HTML (.html)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("txt")}>
            <FileDown className="h-4 w-4 mr-2" />
            Plain Text (.txt)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              // Open the document in a new window with print-optimized
              // HTML and trigger the browser's print dialog there. Using
              // window.print() on the host page would print the entire
              // app chrome (sidebars, toolbars, etc.) — exportToPDF
              // renders only the HDSI content with the publishing
              // settings applied (TOC, page layout, watermarks).
              exportToPDF(nodes, documentTitle, {
                pageLayout: publishing.pageLayout,
                watermarks: publishing.watermarks,
              });
            }}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Bibliography Dialog */}
      <BibliographyDialog 
        open={showBibliography}
        onClose={() => setShowBibliography(false)}
        publishing={publishing}
      />

      {/* Layout Settings Dialog */}
      <LayoutSettingsDialog
        open={showLayoutSettings}
        onClose={() => setShowLayoutSettings(false)}
        layout={publishing.pageLayout}
        onUpdate={publishing.setPageLayout}
      />

      {/* Watermark Settings Dialog */}
      <WatermarkDialog
        open={showWatermarkSettings}
        onClose={() => setShowWatermarkSettings(false)}
        watermarks={publishing.watermarks}
        onAdd={publishing.addWatermark}
        onRemove={publishing.removeWatermark}
      />
    </div>
  );
}

// ============================================================================
// Bibliography Dialog
// ============================================================================

function BibliographyDialog({ 
  open, 
  onClose, 
  publishing 
}: { 
  open: boolean; 
  onClose: () => void;
  publishing: ReturnType<typeof usePublishing>;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Bibliography Manager</DialogTitle>
          <DialogDescription>
            Manage references and citations for your document
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Entries List */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              {publishing.entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No bibliography entries yet</p>
                  <p className="text-sm">Add references to cite them in your document</p>
                </div>
              ) : (
                publishing.entries.map(entry => (
                  <div 
                    key={entry.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{entry.title}</p>
                        <p className="text-xs text-muted-foreground">{entry.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{entry.type}</Badge>
                          <Badge variant="outline" className="text-xs">{entry.year}</Badge>
                          {entry.usageCount > 0 && (
                            <Badge className="text-xs">Cited {entry.usageCount}x</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => publishing.cite(entry.id, "document")}
                        >
                          <Quote className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => publishing.removeEntry(entry.id)}
                          className="text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="w-64 space-y-4">
            <div>
              <span className="text-sm font-medium">Citation Style</span>
              <select 
                className="w-full mt-1 p-2 rounded border"
                value={publishing.activeStyle}
                onChange={(e) => publishing.setActiveStyle(e.target.value as CitationStyle)}
               aria-label="Citation Style">
                {publishing.availableStyles.map(style => (
                  <option key={style} value={style}>{style.toUpperCase()}</option>
                ))}
              </select>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Statistics</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total entries</span>
                  <span>{publishing.entries.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Used in citations</span>
                  <span>{publishing.usedCitations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total citations</span>
                  <span>{publishing.citations.length}</span>
                </div>
              </div>
            </div>
            
            <Button className="w-full" onClick={() => {
              const bibTeX = publishing.entriesToBibTeX();
              navigator.clipboard.writeText(bibTeX);
              toast.success("BibTeX copied to clipboard");
            }}>
              <Download className="h-4 w-4 mr-2" />
              Export BibTeX
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Layout Settings Dialog
// ============================================================================

function LayoutSettingsDialog({
  open,
  onClose,
  layout,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  layout: PageLayout;
  onUpdate: (layout: PageLayout) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page Layout Settings</DialogTitle>
          <DialogDescription>
            Customize document dimensions and formatting
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium">Paper Size</span>
              <select 
                className="w-full mt-1 p-2 rounded border"
                value={layout.size}
                onChange={(e) => onUpdate({ ...layout, size: e.target.value as PageSize })}
               aria-label="Paper Size">
                <option value="letter">Letter (8.5x11")</option>
                <option value="legal">Legal (8.5x14")</option>
                <option value="a4">A4 (210x297mm)</option>
                <option value="a5">A5 (148x210mm)</option>
              </select>
            </div>
            
            <div>
              <span className="text-sm font-medium">Orientation</span>
              <select 
                className="w-full mt-1 p-2 rounded border"
                value={layout.orientation}
                onChange={(e) => onUpdate({ ...layout, orientation: e.target.value as "portrait" | "landscape" })}
               aria-label="Orientation">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>
          
          <div>
            <span className="text-sm font-medium">Margins (mm)</span>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {["top", "bottom", "left", "right"].map((edge) => (
                <div key={edge}>
                  <label className="text-xs capitalize text-muted-foreground">{edge}</label>
                  <input
                    type="number"
                    className="w-full p-2 rounded border"
                    value={layout.margins[edge as keyof typeof layout.margins]}
                    onChange={(e) => onUpdate({
                      ...layout,
                      margins: { ...layout.margins, [edge]: parseFloat(e.target.value) }
                    })}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium">Font Size (pt)</span>
              <input
                type="number"
                className="w-full mt-1 p-2 rounded border"
                value={layout.fontSize}
                onChange={(e) => onUpdate({ ...layout, fontSize: parseFloat(e.target.value) })}
               aria-label="Font Size (pt)"/>
            </div>
            
            <div>
              <span className="text-sm font-medium">Font Family</span>
              <select 
                className="w-full mt-1 p-2 rounded border"
                value={layout.fontFamily}
                onChange={(e) => onUpdate({ ...layout, fontFamily: e.target.value })}
               aria-label="Font Family">
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Computer Modern">Computer Modern (LaTeX)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onClose}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Watermark Dialog
// ============================================================================

function WatermarkDialog({
  open,
  onClose,
  watermarks,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  watermarks: ReturnType<typeof usePublishing>["watermarks"];
  onAdd: (preset: WatermarkPreset | Partial<Watermark>) => string;
  onRemove: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Watermarks</DialogTitle>
          <DialogDescription>
            Add watermarks to your document pages
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(WATERMARK_PRESETS).map(preset => (
              <Button
                key={preset}
                variant="outline"
                onClick={() => {
                  onAdd(preset as WatermarkPreset);
                  toast.success(`${preset} watermark added`);
                }}
              >
                <span className="capitalize">{preset}</span>
              </Button>
            ))}
          </div>
          
          {watermarks.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Watermarks</p>
                {watermarks.map(wm => (
                  <div key={wm.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">{wm.text}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onRemove(wm.id)}
                      className="text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Icons
// ============================================================================

function X(props: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
