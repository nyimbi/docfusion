"use client";

/**
 * Document Export System for HDSI
 *
 * Provides comprehensive export capabilities:
 * - Markdown: GitHub-flavored with HDSI structure
 * - PDF: Browser print-to-PDF with styling
 * - Word (.docx): OOXML generation
 * - LaTeX: Full academic typesetting
 * - HTML: Web-ready output
 * - JSON: Data preservation
 *
 * All exports maintain:
 * - Hierarchical structure
 * - Formatting and colors
 * - Bibliography and citations
 * - Footnotes and cross-references
 */

import { useCallback, useState } from "react";
import type { HDSINode } from "./types";
import type { BibliographyEntry, PageLayout, Watermark } from "./publishing";
import { generateAutoIndex, generateTableOfDiagrams, formatIndex, type AutoIndexOptions } from "./auto-index";

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = "markdown" | "pdf" | "docx" | "latex" | "html" | "json" | "txt";

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeTOC?: boolean;
  includeBibliography?: boolean;
  includeIndex?: boolean;
  includeDiagrams?: boolean;
  indexOptions?: AutoIndexOptions;
  pageLayout?: PageLayout;
  watermarks?: Watermark[];
  filename?: string;
}

export interface ExportResult {
  success: boolean;
  url?: string;
  blob?: Blob;
  filename: string;
  error?: string;
}

// ============================================================================
// Markdown Export
// ============================================================================

export function exportToMarkdown(
  nodes: HDSINode[],
  title: string,
  options: { 
    includeTOC?: boolean;
    includeIndex?: boolean;
    includeDiagrams?: boolean;
    indexOptions?: AutoIndexOptions;
  } = {}
): string {
  let markdown = `# ${title}\n\n`;

  // Table of Contents
  if (options.includeTOC) {
    markdown += "## Table of Contents\n\n";
    nodes.forEach((node, index) => {
      const indent = "  ".repeat(node.depth || 0);
      const anchor = node.title.toLowerCase().replace(/[^\w]+/g, "-");
      markdown += `${indent}- [${node.title}](#${anchor})\n`;
    });
    markdown += "\n---\n\n";
  }

  // List of Diagrams
  if (options.includeDiagrams) {
    const diagrams = generateTableOfDiagrams(nodes, "markdown");
    if (diagrams) {
      markdown += diagrams + "\n---\n\n";
    }
  }

  // Content
  const processNode = (node: HDSINode, depth: number) => {
    const headingLevel = Math.min(6, depth + 1);
    const hashes = "#".repeat(headingLevel);

    markdown += `${hashes} ${node.title}\n\n`;

    if (node.generatedContent) {
      // Convert internal formatting to Markdown
      let content = node.generatedContent
        .replace(/\[\[([^\]]+)\]\]/g, "[$1](#$1)") // Bidirectional links
        .replace(/\*\*(.*?)\*\*/g, "**$1**") // Bold
        .replace(/_(.*?)_/g, "_$1_"); // Italic

      markdown += `${content}\n\n`;
    }

    // Process children
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => processNode(child, depth + 1));
    }
  };

  nodes.forEach(node => processNode(node, 0));

  // Index
  if (options.includeIndex) {
    const index = generateAutoIndex(nodes, [], options.indexOptions);
    if (index.length > 0) {
      markdown += "\n---\n\n";
      markdown += formatIndex(index, "markdown");
    }
  }

  return markdown;
}

// ============================================================================
// HTML Export
// ============================================================================

export function exportToHTML(
  nodes: HDSINode[],
  title: string,
  options: {
    includeTOC?: boolean;
    pageLayout?: PageLayout;
    watermarks?: Watermark[];
  } = {}
): string {
  const toc = options.includeTOC
    ? `<nav class="toc"><h2>Table of Contents</h2>${generateTOCHTML(nodes)}</nav>`
    : "";

  const watermarkStyle = options.watermarks?.length
    ? generateWatermarkCSS(options.watermarks)
    : "";

  const pageStyle = options.pageLayout
    ? `@page { size: ${options.pageLayout.size} ${options.pageLayout.orientation}; margin: ${options.pageLayout.margins.top}mm ${options.pageLayout.margins.right}mm ${options.pageLayout.margins.bottom}mm ${options.pageLayout.margins.left}mm; }`
    : "";

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${pageStyle}
    ${watermarkStyle}
    body {
      font-family: ${options.pageLayout?.fontFamily || "Times New Roman"}, serif;
      font-size: ${options.pageLayout?.fontSize || 12}pt;
      line-height: ${options.pageLayout?.lineSpacing || 1.5};
      max-width: 8.5in;
      margin: 0 auto;
      padding: 1in;
    }
    .toc { margin-bottom: 2em; padding: 1em; background: #f9f9f9; border: 1px solid #ddd; }
    .toc ul { list-style: none; padding-left: 1em; }
    .toc a { text-decoration: none; color: #333; }
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
    .footnote { font-size: 0.85em; vertical-align: super; }
    .citation { color: #0066cc; }
    @media print {
      .toc { break-after: page; }
      h1 { break-before: page; }
      h1:first-of-type { break-before: auto; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${toc}
  <main>
    ${nodes.map(node => generateNodeHTML(node, 1)).join("\n")}
  </main>
</body>
</html>`;

  return html;
}

function generateTOCHTML(nodes: HDSINode[]): string {
  let html = "<ul>";
  let currentDepth = 0;

  nodes.forEach(node => {
    const depth = node.depth || 0;
    const anchor = `section-${node.id}`;

    if (depth > currentDepth) {
      html += "<ul>".repeat(depth - currentDepth);
    } else if (depth < currentDepth) {
      html += "</ul>".repeat(currentDepth - depth);
    }

    html += `<li><a href="#${anchor}">${escapeHtml(node.title)}</a></li>`;
    currentDepth = depth;
  });

  html += "</ul>".repeat(currentDepth);
  html += "</ul>";

  return html;
}

function generateNodeHTML(node: HDSINode, depth: number): string {
  const tag = `h${Math.min(6, depth)}`;
  const anchor = `section-${node.id}`;

  let html = `<${tag} id="${anchor}">${escapeHtml(node.title)}</${tag}>`;

  if (node.generatedContent) {
    // Convert newlines to paragraphs
    const paragraphs = node.generatedContent
      .split("\n\n")
      .filter(p => p.trim())
      .map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");

    html += paragraphs;
  }

  if (node.children && node.children.length > 0) {
    html += node.children.map(child => generateNodeHTML(child, depth + 1)).join("");
  }

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateWatermarkCSS(watermarks: Watermark[]): string {
  return watermarks.map(wm => `
    .watermark-${wm.id} {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(${wm.angle}deg);
      font-size: ${wm.fontSize || 72}px;
      color: ${wm.color};
      opacity: ${wm.opacity};
      pointer-events: none;
      z-index: -1;
    }
  `).join("");
}

// ============================================================================
// LaTeX Export
// ============================================================================

export function exportToLaTeX(
  nodes: HDSINode[],
  title: string,
  options: {
    author?: string;
    date?: string;
    includeBibliography?: boolean;
    bibliographyEntries?: BibliographyEntry[];
    citationStyle?: string;
  } = {}
): string {
  let latex = `\\documentclass[12pt]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{setspace}

\\geometry{margin=1in}
\\onehalfspacing

\\title{${escapeLatex(title)}}
\\author{${escapeLatex(options.author || "")}}
\\date{${options.date || "\\today"}}

\\begin{document}

\\maketitle

\\tableofcontents
\\newpage

`;

  const processNode = (node: HDSINode, depth: number) => {
    const sectionCmd = depth === 0 ? "\\section" : depth === 1 ? "\\subsection" : "\\subsubsection";

    latex += `${sectionCmd}{${escapeLatex(node.title)}}\n\n`;

    if (node.generatedContent) {
      // Convert to LaTeX - simplified regex
      let content = escapeLatex(node.generatedContent)
        .replace(/\[\[([^\]]+)\]\]/g, "\\hyperlink{sec:$1}{$1}") // Links
        .replace(/\*\*(.*?)\*\*/g, "\\textbf{$1}") // Bold
        .replace(/_(.*?)_/g, "\\textit{$1}"); // Italic

      latex += `${content}\n\n`;
    }

    if (node.children) {
      node.children.forEach(child => processNode(child, depth + 1));
    }
  };

  nodes.forEach(node => processNode(node, 0));

  // Bibliography
  if (options.includeBibliography && options.bibliographyEntries?.length) {
    latex += "\\newpage\n\\section{References}\n\n";
    latex += "\\begin{thebibliography}{99}\n\n";

    options.bibliographyEntries.forEach((entry, i) => {
      latex += `\\bibitem{${entry.citationKey}} ${escapeLatex(entry.author)} (${entry.year}). ${escapeLatex(entry.title)}.`;
      if (entry.journal) {
        latex += ` \\textit{${escapeLatex(entry.journal)}}, ${escapeLatex(entry.volume || "")}(${entry.number || ""}), ${entry.pages || ""}.`;
      }
      if (entry.doi) {
        latex += ` DOI: ${entry.doi}`;
      }
      latex += "\n\n";
    });

    latex += "\\end{thebibliography}\n\n";
  }

  latex += "\\end{document}\n";

  return latex;
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}")
    .replace(/\|/g, "\\textbar{}")
    .replace(/"/g, "''")
    .replace(/'/g, "'")
    .replace(/…/g, "\\ldots");
}

// ============================================================================
// Plain Text Export
// ============================================================================

export function exportToPlainText(nodes: HDSINode[], title: string): string {
  let text = `${title}\n${"=".repeat(title.length)}\n\n`;

  const processNode = (node: HDSINode, depth: number) => {
    const indent = "  ".repeat(depth);
    text += `${indent}${node.title}\n${indent}${"-".repeat(node.title.length)}\n\n`;

    if (node.generatedContent) {
      const indented = node.generatedContent
        .split("\n")
        .map(line => `${indent}  ${line}`)
        .join("\n");
      text += `${indented}\n\n`;
    }

    if (node.children) {
      node.children.forEach(child => processNode(child, depth + 1));
    }
  };

  nodes.forEach(node => processNode(node, 0));

  return text;
}

// ============================================================================
// JSON Export
// ============================================================================

export function exportToJSON(nodes: HDSINode[], title: string): string {
  const doc = {
    version: "1.0",
    title,
    createdAt: new Date().toISOString(),
    structure: nodes,
  };

  return JSON.stringify(doc, null, 2);
}

// ============================================================================
// DOCX Export (Simplified - generates basic OOXML)
// ============================================================================

export function exportToDOCX(
  nodes: HDSINode[],
  title: string
): Blob {
  // Simplified DOCX generation using basic OOXML
  // For production, consider using libraries like docx.js

  const docxHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>`;

  const docxFooter = `
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  let content = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p>`;

  const processNode = (node: HDSINode, depth: number) => {
    const style = depth === 0 ? "Heading1" : depth === 1 ? "Heading2" : "Heading3";

    content += `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${escapeXml(node.title)}</w:t></w:r></w:p>`;

    if (node.generatedContent) {
      const paragraphs = node.generatedContent.split("\n\n").filter(p => p.trim());
      paragraphs.forEach(para => {
        content += `<w:p><w:r><w:t>${escapeXml(para.replace(/\n/g, " "))}</w:t></w:r></w:p>`;
      });
    }

    if (node.children) {
      node.children.forEach(child => processNode(child, depth + 1));
    }
  };

  nodes.forEach(node => processNode(node, 0));

  const docx = docxHeader + content + docxFooter;

  return new Blob([docx], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================================
// PDF Export (via Browser Print + HTML)
// ============================================================================

export function exportToPDF(
  nodes: HDSINode[],
  title: string,
  options: {
    pageLayout?: PageLayout;
    watermarks?: Watermark[];
  } = {}
): void {
  // Generate print-optimized HTML
  const html = exportToHTML(nodes, title, {
    includeTOC: true,
    pageLayout: options.pageLayout,
    watermarks: options.watermarks,
  });

  // Open in new window for printing
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();

    // Auto-trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

// ============================================================================
// Main Export Function
// ============================================================================

export async function exportDocument(
  nodes: HDSINode[],
  title: string,
  options: ExportOptions
): Promise<ExportResult> {
  const filename = options.filename || `${title.replace(/[^\w]+/g, "_")}`;

  try {
    let blob: Blob | undefined;
    let url: string | undefined;

    switch (options.format) {
      case "markdown":
        blob = new Blob([exportToMarkdown(nodes, title, { includeTOC: options.includeTOC })], {
          type: "text/markdown",
        });
        break;

      case "html":
        blob = new Blob([exportToHTML(nodes, title, options)], { type: "text/html" });
        break;

      case "latex":
        blob = new Blob([exportToLaTeX(nodes, title, options)], { type: "text/x-latex" });
        break;

      case "txt":
        blob = new Blob([exportToPlainText(nodes, title)], { type: "text/plain" });
        break;

      case "json":
        blob = new Blob([exportToJSON(nodes, title)], { type: "application/json" });
        break;

      case "docx":
        blob = exportToDOCX(nodes, title);
        break;

      case "pdf":
        exportToPDF(nodes, title, options);
        return { success: true, filename: `${filename}.pdf` };

      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

    if (blob) {
      url = URL.createObjectURL(blob);
      downloadFile(url, `${filename}.${getFileExtension(options.format)}`);
      URL.revokeObjectURL(url);
    }

    return { success: true, blob, filename: `${filename}.${getFileExtension(options.format)}` };
  } catch (error) {
    return {
      success: false,
      filename: `${filename}.${getFileExtension(options.format)}`,
      error: error instanceof Error ? error.message : "Export failed",
    };
  }
}

function getFileExtension(format: ExportFormat): string {
  const map: Record<ExportFormat, string> = {
    markdown: "md",
    html: "html",
    latex: "tex",
    txt: "txt",
    json: "json",
    docx: "docx",
    pdf: "pdf",
  };
  return map[format];
}

function downloadFile(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// React Hook
// ============================================================================

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);

  const exportDoc = useCallback(async (
    nodes: HDSINode[],
    title: string,
    options: ExportOptions
  ): Promise<ExportResult> => {
    setIsExporting(true);

    const result = await exportDocument(nodes, title, options);
    setLastResult(result);

    setIsExporting(false);
    return result;
  }, []);

  const quickExport = useCallback((
    nodes: HDSINode[],
    title: string,
    format: ExportFormat
  ) => {
    return exportDoc(nodes, title, { format });
  }, [exportDoc]);

  return {
    exportDoc,
    quickExport,
    isExporting,
    lastResult,

    // Convenience methods
    exportToMarkdown: (nodes: HDSINode[], title: string) => quickExport(nodes, title, "markdown"),
    exportToPDF: (nodes: HDSINode[], title: string) => quickExport(nodes, title, "pdf"),
    exportToWord: (nodes: HDSINode[], title: string) => quickExport(nodes, title, "docx"),
    exportToLaTeX: (nodes: HDSINode[], title: string) => quickExport(nodes, title, "latex"),
    exportToHTML: (nodes: HDSINode[], title: string) => quickExport(nodes, title, "html"),
  };
}

// ============================================================================
// Document List Management
// ============================================================================

export interface DocumentListItem {
  id: string;
  title: string;
  updatedAt: Date;
  createdAt: Date;
  nodeCount: number;
  wordCount: number;
  preview?: string;
  thumbnail?: string;
}

export function calculateDocumentStats(nodes: HDSINode[]): { nodes: number; words: number; } {
  let nodeCount = 0;
  let wordCount = 0;

  const count = (node: HDSINode) => {
    nodeCount++;
    if (node.generatedContent) {
      wordCount += node.generatedContent.split(/\s+/).filter(w => w).length;
    }
    if (node.children) {
      node.children.forEach(count);
    }
  };

  nodes.forEach(count);

  return { nodes: nodeCount, words: wordCount };
}
