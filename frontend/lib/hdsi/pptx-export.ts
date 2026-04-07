"use client";

/**
 * PowerPoint Export Engine using PptxGenJS
 * 
 * Professional .pptx generation with:
 * - Format-specific themes (BCG, McKinsey, Military)
 * - Master slides with logos/headers
 * - Charts, tables, images
 * - Speaker notes
 * - Classification banners (military)
 */

import { useState, useCallback } from "react";
import type { Presentation, Slide, ChartConfig, TableConfig, ChartDataPoint, ChartSeries } from "./presentations";
import type { ConsultingFormat, MilitaryFormatType } from "./presentation-formats";
import { BCG_FORMAT, MCKINSEY_FORMAT, BAIN_FORMAT, MILITARY_DECISION_BRIEF } from "./presentation-formats";
import type { PresentationTheme } from "./presentations";

// PptxGenJS instance type — covers the API surface we use
interface PptxGenJSInstance {
  author: string;
  company: string;
  subject: string;
  title: string;
  ChartType: Record<string, unknown>;
  defineSlideMaster(opts: Record<string, unknown>): void;
  addSlide(opts?: Record<string, unknown>): PptxSlideInstance;
  writeFile(opts: { fileName: string }): Promise<void>;
}

interface PptxSlideInstance {
  addText(text: string | Array<Record<string, unknown>>, opts?: Record<string, unknown>): void;
  addChart(type: unknown, data: PptxChartData[], opts?: Record<string, unknown>): void;
  addTable(rows: PptxTableCell[][], opts?: Record<string, unknown>): void;
  addNotes(notes: string): void;
}

interface PptxChartData {
  name: string;
  labels: string[];
  values: number[];
}

interface PptxTableCell {
  text: string;
  options: Record<string, unknown>;
}

type PptxGenJSConstructor = new () => PptxGenJSInstance;

// Dynamic import of PptxGenJS to avoid Node.js module issues at build time
let PptxGenJS: PptxGenJSConstructor | null = null;

async function getPptxGenJS(): Promise<PptxGenJSConstructor> {
  if (!PptxGenJS) {
    const mod = await import("pptxgenjs");
    PptxGenJS = (mod.default || mod) as unknown as PptxGenJSConstructor;
  }
  return PptxGenJS;
}

// ============================================================================
// Export Options
// ============================================================================

export interface PPTXExportOptions {
  filename?: string;
  includeSpeakerNotes?: boolean;
  includeBackupSlides?: boolean;
  includeClassification?: boolean;
  
  // Format-specific
  consultingFormat?: "bcg" | "mckinsey" | "bain" | "deloitte";
  militaryFormat?: "decision" | "information" | "conops" | "staft";
  classificationLevel?: "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP SECRET";
  
  // Metadata
  author?: string;
  company?: string;
  subject?: string;
}

// ============================================================================
// Main Export Function
// ============================================================================

export async function exportToPPTX(
  presentation: Presentation,
  options: PPTXExportOptions = {}
): Promise<void> {
  const PptxGenJSClass = await getPptxGenJS();
  const pptx = new PptxGenJSClass();
  
  // Set metadata
  pptx.author = options.author || "HDSI Export";
  pptx.company = options.company || "";
  pptx.subject = options.subject || presentation.title;
  pptx.title = presentation.title;
  
  // Determine format styling
  const formatStyle = determineFormatStyle(options, presentation);
  
  // Create master slide
  createMasterSlide(pptx, formatStyle, options);
  
  // Generate slides
  presentation.slides.forEach((slide, index) => {
    createContentSlide(pptx, slide, formatStyle, options, index);
  });
  
  // Add backup slides if requested
  if (options.includeBackupSlides) {
    createBackupSection(pptx, presentation, formatStyle);
  }
  
  // Save
  const filename = options.filename || `${presentation.title.replace(/[^\w]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}

// ============================================================================
// Format Style Determination
// ============================================================================

function determineFormatStyle(
  options: PPTXExportOptions,
  presentation: Presentation
): FormatStyle {
  // Check for military format
  if (options.militaryFormat || presentation.theme.name.toLowerCase().includes("military")) {
    const classification = options.classificationLevel || "UNCLASSIFIED";
    return {
      type: "military",
      classification,
      theme: MILITARY_DECISION_BRIEF.theme,
      colors: MILITARY_DECISION_BRIEF.theme.colors,
      fonts: MILITARY_DECISION_BRIEF.theme.fonts,
      logoPosition: "none",
      hasClassificationBanner: true,
    };
  }
  
  // Check for consulting format
  const consultingFormat = options.consultingFormat || 
    presentation.theme.name.toLowerCase().includes("bcg") ? "bcg" :
    presentation.theme.name.toLowerCase().includes("mckinsey") ? "mckinsey" :
    presentation.theme.name.toLowerCase().includes("bain") ? "bain" : "mckinsey";
  
  const format = consultingFormat === "bcg" ? BCG_FORMAT :
                 consultingFormat === "bain" ? BAIN_FORMAT :
                 MCKINSEY_FORMAT;
  
  return {
    type: "consulting",
    consultingFormat,
    theme: format.theme,
    colors: format.theme.colors,
    fonts: format.theme.fonts,
    logoPosition: format.visual.logoPosition,
    hasClassificationBanner: false,
  };
}

interface FormatStyle {
  type: "consulting" | "military" | "corporate";
  classification?: string;
  consultingFormat?: string;
  theme: PresentationTheme;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    textLight: string;
    background: string;
  };
  fonts: {
    title: string;
    body: string;
  };
  logoPosition: string;
  hasClassificationBanner: boolean;
}

// ============================================================================
// Master Slide Creation
// ============================================================================

function createMasterSlide(
  pptx: PptxGenJSInstance,
  style: FormatStyle,
  options: PPTXExportOptions
): void {
  const objects: Array<{ text: { text: string; options: Record<string, unknown> } }> = [];
  
  // Page number
  objects.push({
    text: {
      text: "Slide X of Y",
      options: {
        x: 9, y: "95%", w: 1, h: 0.3,
        color: style.colors.textLight,
        fontSize: 10,
        align: "right" as const,
      },
    },
  });
  
  // Source citation area (consulting)
  if (style.type === "consulting") {
    objects.push({
      text: {
        text: "Source: [To be added]",
        options: {
          x: 0.5, y: "92%", w: 4, h: 0.2,
          color: style.colors.textLight,
          fontSize: 8,
          italic: true,
        },
      },
    });
  }
  
  pptx.defineSlideMaster({
    title: "HDSI_MASTER_SLIDE",
    background: { color: style.colors.background },
    objects,
  });
}

function getClassificationColor(classification: string): string {
  const colors: Record<string, string> = {
    "UNCLASSIFIED": "000000",
    "CONFIDENTIAL": "8B0000",
    "SECRET": "FF0000",
    "TOP SECRET": "FF6600",
  };
  return colors[classification] || "000000";
}

// ============================================================================
// Content Slide Creation
// ============================================================================

function createContentSlide(
  pptx: PptxGenJSInstance,
  slide: Slide,
  style: FormatStyle,
  options: PPTXExportOptions,
  index: number
): void {
  const isMilitary = style.type === "military";
  const topMargin = isMilitary ? 0.5 : 0.3;  // Account for classification banner
  
  const pptSlide = pptx.addSlide({ masterName: "HDSI_MASTER_SLIDE" });
  
  // Add speaker notes
  if (options.includeSpeakerNotes && slide.speakerNotes) {
    pptSlide.addNotes(slide.speakerNotes);
  }
  
  // Slide type indicator (military) - uppercase manually since API doesn't support it
  if (isMilitary) {
    const sectionType = getMilitarySectionType(slide.type);
    if (sectionType) {
      pptSlide.addText(sectionType.toUpperCase(), {
        x: 0.5, y: topMargin, w: 2, h: 0.3,
        fontSize: 12,
        color: style.colors.accent,
        bold: true,
      });
    }
  }
  
  // Title - Action title for consulting, section title for military
  const titleY = isMilitary ? topMargin + 0.4 : topMargin;
  pptSlide.addText(slide.actionTitle, {
    x: 0.5,
    y: titleY,
    w: 9,
    h: 0.8,
    fontSize: isMilitary ? 20 : 28,
    color: style.colors.primary,
    bold: true,
    fontFace: style.fonts.title,
  });
  
  // Subtitle
  if (slide.subtitle) {
    pptSlide.addText(slide.subtitle, {
      x: 0.5,
      y: titleY + 0.7,
      w: 9,
      h: 0.4,
      fontSize: 14,
      color: style.colors.textLight,
      fontFace: style.fonts.body,
    });
  }
  
  // Content area
  const contentY = titleY + (slide.subtitle ? 1.2 : 0.9);
  const contentHeight = isMilitary ? 5.5 : 6;
  
  // Render based on layout
  switch (slide.layout) {
    case "title-only":
      // Title already added, nothing else
      break;
      
    case "title-content":
      addBulletContent(pptSlide, slide, style, { x: 0.5, y: contentY, w: 9, h: contentHeight });
      break;
      
    case "title-chart":
      if (slide.chart) {
        addChart(pptSlide, slide.chart, style, { x: 0.5, y: contentY, w: 9, h: contentHeight }, pptx);
      } else {
        addBulletContent(pptSlide, slide, style, { x: 0.5, y: contentY, w: 9, h: contentHeight });
      }
      break;
      
    case "title-2col":
      // Left column: bullets
      addBulletContent(pptSlide, slide, style, { x: 0.5, y: contentY, w: 4.2, h: contentHeight });
      // Right column: could be chart or bullets
      if (slide.chart) {
        addChart(pptSlide, slide.chart, style, { x: 5, y: contentY, w: 4.5, h: contentHeight }, pptx);
      }
      break;
      
    case "full-chart":
      if (slide.chart) {
        addChart(pptSlide, slide.chart, style, { x: 0.5, y: contentY, w: 9, h: contentHeight }, pptx);
      }
      break;
  }
  
  // Table (if present)
  if (slide.table) {
    addTable(pptSlide, slide.table, style, { x: 0.5, y: contentY, w: 9, h: 3 });
  }
}

function getMilitarySectionType(slideType: string): string | null {
  const mapping: Record<string, string> = {
    "situation": "SITUATION",
    "complication": "COMPLICATION", 
    "resolution": "RESOLUTION",
    "supporting-point": "EXECUTION",
    "next-steps": "COMMAND & SIGNAL",
  };
  return mapping[slideType] || null;
}

// ============================================================================
// Content Helpers
// ============================================================================

function addBulletContent(
  slide: PptxSlideInstance,
  content: Slide,
  style: FormatStyle,
  bounds: { x: number; y: number; w: number; h: number }
): void {
  if (!content.bullets || content.bullets.length === 0) return;
  
  const bulletText = content.bullets.map(b => ({ text: b, options: { breakLine: true } }));
  
  slide.addText(bulletText, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    fontSize: 14,
    color: style.colors.text,
    fontFace: style.fonts.body,
    bullet: { type: "number" },
    lineSpacing: 28,
  });
}

function addChart(
  slide: PptxSlideInstance,
  chart: ChartConfig,
  style: FormatStyle,
  bounds: { x: number; y: number; w: number; h: number },
  pptx: PptxGenJSInstance
): void {
  // Convert chart data to PptxGenJS format
  const chartData = convertChartData(chart);

  // Map chart types
  const chartTypeMap: Record<string, unknown> = {
    "column": pptx.ChartType.bar,
    "bar": pptx.ChartType.bar,
    "line": pptx.ChartType.line,
    "pie": pptx.ChartType.pie,
  };

  const chartType = chartTypeMap[chart.type] || pptx.ChartType.bar;
  
  slide.addChart(chartType, chartData, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    chartColors: chart.colors || [style.colors.accent, style.colors.secondary],
    showLegend: chart.showLegend ?? true,
    showValue: chart.showValues ?? false,
    title: chart.title || "",
    titleColor: style.colors.primary,
    titleFontFace: style.fonts.title,
    titleFontSize: 14,
  });
}

function convertChartData(chart: ChartConfig): PptxChartData[] {
  // Handle series data
  if (Array.isArray(chart.data) && chart.data.length > 0 && "data" in chart.data[0]) {
    return (chart.data as ChartSeries[]).map(series => ({
      name: series.name,
      labels: chart.xAxis?.categories || [],
      values: series.data,
    }));
  }

  // Handle simple data points
  const dataPoints = chart.data as ChartDataPoint[];
  return [{
    name: "Data",
    labels: dataPoints.map(d => d.label || ""),
    values: dataPoints.map(d => d.value || 0),
  }];
}

function addTable(
  slide: PptxSlideInstance,
  table: TableConfig,
  style: FormatStyle,
  bounds: { x: number; y: number; w: number; h: number }
): void {
  // Convert to proper TableCell format
  const rows: PptxTableCell[][] = [
    table.headers.map(h => ({ text: String(h), options: { bold: true, fill: style.colors.secondary } })),
    ...table.rows.map(row => 
      row.map(cell => ({ text: String(cell), options: {} }))
    ),
  ];
  
  const colW = table.headers.map(() => bounds.w / table.headers.length);
  
  slide.addTable(rows, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    color: style.colors.text,
    fontFace: style.fonts.body,
    fontSize: 10,
    border: { type: "solid", pt: 0.5, color: style.colors.textLight },
    fill: { color: style.colors.background },
    colW,
  });
}

// ============================================================================
// Backup Slides Section
// ============================================================================

function createBackupSection(
  pptx: PptxGenJSInstance,
  presentation: Presentation,
  style: FormatStyle
): void {
  // Section divider slide for backup
  const divider = pptx.addSlide({ masterName: "HDSI_MASTER_SLIDE" });
  divider.addText("BACKUP SLIDES", {
    x: 2, y: 3, w: 6, h: 1,
    fontSize: 36,
    color: style.colors.primary,
    bold: true,
    align: "center",
  });
  divider.addNotes("Backup slides for Q&A. Not part of main storyline.");
}

// ============================================================================
// React Hook
// ============================================================================

export function usePPTXExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const exportPresentation = useCallback(async (
    presentation: Presentation,
    options?: PPTXExportOptions
  ) => {
    setIsExporting(true);
    setLastError(null);
    
    try {
      await exportToPPTX(presentation, options);
      setIsExporting(false);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Export failed";
      setLastError(msg);
      setIsExporting(false);
      return { success: false, error: msg };
    }
  }, []);
  
  return {
    exportPresentation,
    isExporting,
    lastError,
  };
}
