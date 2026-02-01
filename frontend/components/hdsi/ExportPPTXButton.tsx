"use client";

/**
 * ExportPPTXButton - PowerPoint Export Button
 * 
 * Features:
 * - Format selection dropdown (BCG, McKinsey, Bain, Military formats)
 * - Classification banner control (military)
 * - Speaker notes toggle
 * - Export progress indication
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, FileText, Loader2, ChevronDown, Megaphone } from "lucide-react";
import { usePPTXExport } from "@/lib/hdsi/pptx-export";
import type { PPTXExportOptions } from "@/lib/hdsi/pptx-export";
import type { Presentation, PresentationTheme } from "@/lib/hdsi/presentations";

interface ExportPPTXButtonProps {
  documentTitle: string;
  documentNodes: any[];  // HDSINode[] - will convert to presentation
  presentation?: Presentation;  // Optional: use if already built
  disabled?: boolean;
  size?: "sm" | "icon";
  variant?: "secondary" | "outline" | "ghost";
}

export function ExportPPTXButton({
  documentTitle,
  documentNodes,
  presentation: providedPresentation,
  disabled = false,
  size = "sm",
  variant = "outline",
}: ExportPPTXButtonProps) {
  const { exportPresentation, isExporting } = usePPTXExport();
  const [selectedFormat, setSelectedFormat] = useState<PPTXExportOptions["consultingFormat"]>("mckinsey");
  const [selectedClassification, setSelectedClassification] = useState<string>("UNCLASSIFIED");
  const [includeSpeakerNotes, setIncludeSpeakerNotes] = useState(true);
  const [includeBackupSlides, setIncludeBackupSlides] = useState(true);
  const [isMilitary, setIsMilitary] = useState(false);

  // Build presentation from nodes if not provided
  const presentation = providedPresentation || buildPresentationFromNodes(documentNodes, documentTitle);

  const handleExport = useCallback(async () => {
    const formatOptions: PPTXExportOptions = {
      filename: `${documentTitle.replace(/[^\w]+/g, "_")}.pptx`,
      includeSpeakerNotes,
      includeBackupSlides,
      ...(isMilitary
        ? {
            militaryFormat: "decision" as const,
            classificationLevel: selectedClassification as any,
            includeClassification: true,
          }
        : {
            consultingFormat: selectedFormat,
          }),
      author: "HDSI Presentation System",
      subject: documentTitle,
    };

    await exportPresentation(presentation, formatOptions);
  }, [
    exportPresentation,
    presentation,
    documentTitle,
    selectedFormat,
    isMilitary,
    selectedClassification,
    includeSpeakerNotes,
    includeBackupSlides,
  ]);

  return (
    <TooltipProvider>
      <DropdownMenu>
        <div className="flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={variant}
                size={size}
                onClick={handleExport}
                disabled={disabled || isExporting}
                className="rounded-r-none"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : isMilitary ? (
                  <Megaphone className="h-4 w-4 mr-1.5" />
                ) : (
                  <FileText className="h-4 w-4 mr-1.5" />
                )}
                <span className="hidden sm:inline">
                  {isExporting ? "Exporting..." : "PowerPoint"}
                </span>
                <span className="sm:hidden">PPTX</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export to PowerPoint presentation</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size={size}
              disabled={disabled || isExporting}
              className="rounded-l-none border-l border-l-white/20 px-2"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </div>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Format Options</DropdownMenuLabel>

          <DropdownMenuCheckboxItem
            checked={!isMilitary}
            onCheckedChange={(checked) => setIsMilitary(!checked)}
          >
            Consulting Format
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={isMilitary}
            onCheckedChange={setIsMilitary}
          >
            Military Format
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          {!isMilitary ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Consulting Style
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSelectedFormat("bcg")}>
                {selectedFormat === "bcg" && <Check className="mr-2 h-4 w-4" />}
                <span className={selectedFormat === "bcg" ? "font-medium" : ""}>BCG</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedFormat("mckinsey")}>
                {selectedFormat === "mckinsey" && <Check className="mr-2 h-4 w-4" />}
                <span className={selectedFormat === "mckinsey" ? "font-medium" : ""}>McKinsey</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedFormat("bain")}>
                {selectedFormat === "bain" && <Check className="mr-2 h-4 w-4" />}
                <span className={selectedFormat === "bain" ? "font-medium" : ""}>Bain</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedFormat("deloitte")}>
                {selectedFormat === "deloitte" && <Check className="mr-2 h-4 w-4" />}
                <span className={selectedFormat === "deloitte" ? "font-medium" : ""}>Deloitte</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Classification Level
              </DropdownMenuLabel>
              {["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP SECRET"].map((level) => (
                <DropdownMenuItem
                  key={level}
                  onClick={() => setSelectedClassification(level)}
                >
                  {selectedClassification === level && <Check className="mr-2 h-4 w-4" />}
                  <span className={selectedClassification === level ? "font-medium" : ""}>
                    {level}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Export Options
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={includeSpeakerNotes}
              onCheckedChange={setIncludeSpeakerNotes}
            >
              Include Speaker Notes
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={includeBackupSlides}
              onCheckedChange={setIncludeBackupSlides}
            >
              Include Backup Slides
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

/**
 * Build a presentation from HDSI document nodes
 */
function buildPresentationFromNodes(nodes: any[], title: string): Presentation {
  // Simple conversion - first node becomes title slide, rest become content slides
  const slides: any[] = [];

  // Title slide
  if (nodes.length > 0) {
    slides.push({
      id: crypto.randomUUID(),
      type: "executive-summary",
      order: 1,
      actionTitle: title,
      subtitle: nodes[0]?.content || "",
      bullets: [],
      speakerNotes: "Executive summary slide. Key message to convey.",
    });
  }

  // Content slides from H2 nodes
  nodes.forEach((node, idx) => {
    if (node.level === 2 && node.children?.length > 0) {
      const bullets = node.children
        .filter((c: any) => c.type === "bullet-block" || c.level === 3)
        .map((c: any) => c.content || "")
        .filter(Boolean);

      if (bullets.length > 0 || node.content) {
        slides.push({
          id: crypto.randomUUID(),
          type: "supporting-point",
          order: idx + 2,
          actionTitle: node.content || "Key Point",
          bullets,
          speakerNotes: `Discuss ${node.content}. Key message: ${bullets[0] || "TBD"}`,
        });
      }
    }
  });

  const theme: PresentationTheme = {
    name: "consulting",
    colors: {
      primary: "003366",
      secondary: "0066CC",
      accent: "FF6600",
      background: "FFFFFF",
      text: "333333",
      textLight: "666666",
      positive: "009900",
      negative: "CC0000",
      warning: "FF6600",
    },
    fonts: {
      title: "Calibri",
      body: "Calibri",
    },
  };

  return {
    id: crypto.randomUUID(),
    title,
    framework: "SCR",
    slides,
    theme,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
