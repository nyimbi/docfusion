"use client";

/**
 * Publishing & Document Production System for HDSI
 * 
 * Comprehensive LaTeX-style publishing features:
 * - Bibliography management (citations, references, styles)
 * - Index creation with auto-marking
 * - Table of contents generation
 * - Cross-references (figures, tables, sections, pages)
 * - Footnotes and endnotes
 * - Sidebars and margin notes
 * - Page layout and formatting
 * - Watermarks
 * - Pagination controls
 * 
 * All features integrate with LaTeX export for professional typesetting.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type { HDSINode } from "./types";

// ============================================================================
// Bibliography Management
// ============================================================================

export type CitationStyle = "apa" | "mla" | "chicago" | "ieee" | "harvard" | "vancouver" | "custom";

export interface BibliographyEntry {
  id: string;
  citationKey: string;  // For LaTeX \cite{key}
  type: "article" | "book" | "inbook" | "incollection" | "inproceedings" | 
        "manual" | "mastersthesis" | "misc" | "phdthesis" | "proceedings" | 
        "techreport" | "unpublished" | "online" | "report";
  
  // Common fields
  title: string;
  author: string;
  year: number | string;
  
  // Optional fields
  journal?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  address?: string;
  edition?: string;
  editor?: string;
  chapter?: string;
  series?: string;
  organization?: string;
  school?: string;
  institution?: string;
  note?: string;
  month?: string;
  howpublished?: string;
  
  // Auto-generated
  formattedCitation?: string;
  usageCount: number;
  firstUsedIn?: string;  // Node ID
}

export interface Citation {
  id: string;
  entryId: string;
  citationKey: string;
  location: string;  // Node ID
  position: number;  // Character position
  context?: string;  // Surrounding text
  suppressAuthor?: boolean;  // For "(2023)" vs "Smith (2023)"
  pageNumber?: string;  // For "(Smith, 2023, p.45)"
}

export interface BibliographyStyle {
  name: string;
  label: string;
  
  // Formatter functions
  formatCitation: (entry: BibliographyEntry, options?: { suppressAuthor?: boolean; page?: string }) => string;
  formatReference: (entry: BibliographyEntry) => string;
  
  // Sorting
  sortKey: (entry: BibliographyEntry) => string;
}

export const BIBLIOGRAPHY_STYLES: Record<CitationStyle, BibliographyStyle> = {
  apa: {
    name: "apa",
    label: "APA 7th Edition",
    formatCitation: (entry, options) => {
      const author = entry.author.split(" and ")[0];
      const lastName = author.split(",").map(s => s.trim())[0];
      const year = entry.year;
      const page = options?.page ? `, p. ${options.page}` : "";
      
      if (options?.suppressAuthor) {
        return `(${year}${page})`;
      }
      return `(${lastName}, ${year}${page})`;
    },
    formatReference: (entry) => {
      const authors = entry.author.replace(/ and /g, ", ");
      let ref = `${authors} (${entry.year}). ${entry.title}.`;
      if (entry.journal) ref += ` *${entry.journal}*, ${entry.volume}(${entry.number}), ${entry.pages}.`;
      if (entry.doi) ref += ` https://doi.org/${entry.doi}`;
      if (entry.url && !entry.doi) ref += ` ${entry.url}`;
      return ref;
    },
    sortKey: (e) => `${e.author.split(" and ")[0]}${e.year}`,
  },
  
  mla: {
    name: "mla",
    label: "MLA 9th Edition",
    formatCitation: (entry, options) => {
      const page = options?.page ? ` ${options.page}` : "";
      return entry.author.split(" and ")[0].split(",")[0] + page;
    },
    formatReference: (entry) => {
      const author = entry.author.replace(/ and /g, ", ");
      return `${author}. "${entry.title}." ${entry.journal || entry.publisher}, ${entry.year}.`;
    },
    sortKey: (e) => e.author.split(" and ")[0].split(",")[0],
  },
  
  chicago: {
    name: "chicago",
    label: "Chicago 17th Edition",
    formatCitation: (entry, options) => {
      const author = entry.author.split(" and ")[0].split(",")[0];
      const page = options?.page ? `, ${options.page}` : "";
      return `${author}, *${entry.title}* (${entry.year}${page})`;
    },
    formatReference: (entry) => {
      const author = entry.author.replace(/ and /g, " and ");
      let ref = `${author}. *${entry.title}*. ${entry.publisher || ""}, ${entry.year}.`;
      if (entry.journal) ref = `${author}. "${entry.title}." *${entry.journal}* ${entry.volume}, no. ${entry.number} (${entry.year}): ${entry.pages}.`;
      return ref;
    },
    sortKey: (e) => e.author.split(" and ")[0],
  },
  
  ieee: {
    name: "ieee",
    label: "IEEE",
    formatCitation: (entry, options) => {
      // IEEE uses [1], [2] numbered citations
      return `[${entry.citationKey}]`;
    },
    formatReference: (entry) => {
      const authors = entry.author.split(" and ").map(a => {
        const parts = a.split(",").map(s => s.trim());
        return parts.length > 1 ? `${parts[1][0]}. ${parts[0]}` : a;
      }).join(", ");
      
      if (entry.journal) {
        return `[${entry.citationKey}] ${authors}, "${entry.title}," *${entry.journal}*, vol. ${entry.volume}, no. ${entry.number}, pp. ${entry.pages}, ${entry.year}.`;
      }
      return `[${entry.citationKey}] ${authors}, *${entry.title}*. ${entry.publisher}, ${entry.year}.`;
    },
    sortKey: (e) => e.citationKey,
  },
  
  harvard: {
    name: "harvard",
    label: "Harvard",
    formatCitation: (entry, options) => {
      const author = entry.author.split(" and ")[0].split(",")[0];
      const year = entry.year;
      const page = options?.page ? `, p. ${options.page}` : "";
      
      if (options?.suppressAuthor) {
        return `(${year}${page})`;
      }
      return `${author} (${year}${page})`;
    },
    formatReference: (entry) => {
      const author = entry.author.replace(/ and /g, " and ");
      let ref = `${author} (${entry.year}) *${entry.title}*.`;
      if (entry.journal) ref = `${author} (${entry.year}) '${entry.title}', *${entry.journal}*, ${entry.volume}(${entry.number}), pp. ${entry.pages}.`;
      if (entry.publisher) ref += ` ${entry.publisher}.`;
      if (entry.doi) ref += ` doi: ${entry.doi}.`;
      return ref;
    },
    sortKey: (e) => `${e.author.split(" and ")[0]}${e.year}`,
  },
  
  vancouver: {
    name: "vancouver",
    label: "Vancouver",
    formatCitation: (entry) => `[${entry.citationKey}]`,
    formatReference: (entry) => {
      // Vancouver uses numbered citations
      const authors = entry.author.split(" and ").map((a, i) => {
        if (i > 5) return "et al.";
        const parts = a.split(",").map(s => s.trim());
        return `${parts[0]} ${parts[1]?.[0] || ""}`;
      }).join(", ");
      
      let ref = `${authors}. ${entry.title}. `;
      if (entry.journal) ref += `${entry.journal}. ${entry.year};${entry.volume}(${entry.number}):${entry.pages}.`;
      else ref += `${entry.publisher}; ${entry.year}.`;
      return ref;
    },
    sortKey: (e) => e.citationKey,
  },
  
  custom: {
    name: "custom",
    label: "Custom",
    formatCitation: () => "",
    formatReference: () => "",
    sortKey: (e) => e.citationKey,
  },
};

// ============================================================================
// Index Management
// ============================================================================

export interface IndexEntry {
  id: string;
  term: string;
  subterm?: string;
  location: string;  // Node ID
  page?: number;     // Computed during pagination
  see?: string;      // Cross-reference to another term
  seeAlso?: string[]; // Related terms
}

export interface IndexCategory {
  letter: string;
  entries: IndexEntry[];
}

// ============================================================================
// Table of Contents
// ============================================================================

export interface TOCEntry {
  id: string;
  level: number;  // 0 = chapter, 1 = section, 2 = subsection
  title: string;
  nodeId: string;
  page?: number;
  children?: TOCEntry[];
}

export interface TOCOptions {
  maxDepth: number;
  includeNumbers: boolean;
  numberStyle: "decimal" | "roman" | "alpha";
  separator: string;
}

// ============================================================================
// Cross-References
// ============================================================================

export type ReferenceType = "figure" | "table" | "section" | "page" | "footnote" | "equation" | "appendix";

export interface CrossReference {
  id: string;
  type: ReferenceType;
  targetId: string;
  label?: string;
  customText?: string;
  location: string;  // Node ID where reference appears
  context?: string;
}

export interface ReferenceTarget {
  id: string;
  type: ReferenceType;
  number: string;  // "Fig. 1", "Table 2", "Section 3.2"
  title: string;
  page?: number;
  nodeId: string;
}

// ============================================================================
// Footnotes & Endnotes
// ============================================================================

export interface Footnote {
  id: string;
  number: number;
  content: string;
  location: string;  // Node ID
  position: number;  // Character position
  marker?: string;   // Custom marker if not numeric
}

export type NotePlacement = "footnote" | "endnote" | "sidenote" | "marginnote";

// ============================================================================
// Sidebars & Margin Notes
// ============================================================================

export interface MarginNote {
  id: string;
  content: string;
  align: "left" | "right";
  location: string;  // Node ID
  referenceText?: string;
  icon?: string;
  color?: string;
}

export interface Sidebar {
  id: string;
  title?: string;
  content: string;
  location: string;
  width: "narrow" | "medium" | "wide";
  float: "left" | "right";
  borderStyle?: "solid" | "dashed" | "dotted" | "none";
  background?: string;
}

// ============================================================================
// Page Layout
// ============================================================================

export type PageSize = "letter" | "legal" | "a4" | "a5" | "custom";
export type PageOrientation = "portrait" | "landscape";

export interface PageMargins {
  top: number;      // mm or inches
  bottom: number;
  left: number;
  right: number;
  gutter?: number;  // For binding
}

export interface PageLayout {
  size: PageSize;
  orientation: PageOrientation;
  margins: PageMargins;
  columns: 1 | 2;
  columnGap?: number;
  lineSpacing: "single" | "1.5" | "double" | number;
  paragraphSpacing: number;
  fontSize: number;
  fontFamily: string;
}

export const DEFAULT_PAGE_LAYOUT: PageLayout = {
  size: "letter",
  orientation: "portrait",
  margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
  columns: 1,
  lineSpacing: 1.15,
  paragraphSpacing: 12,
  fontSize: 12,
  fontFamily: "Times New Roman",
};

// ============================================================================
// Watermarks
// ============================================================================

export interface Watermark {
  id: string;
  text?: string;
  image?: string;  // Base64
  opacity: number;  // 0-1
  angle: number;    // degrees
  color: string;
  fontSize?: number;
  pages: "all" | "first" | "even" | "odd" | number[];
  position: "center" | "diagonal" | "custom";
  customX?: number;
  customY?: number;
}

export type WatermarkPreset = "draft" | "confidential" | "review" | "sample" | "final";

export const WATERMARK_PRESETS: Record<WatermarkPreset, Partial<Watermark>> = {
  draft: { text: "DRAFT", opacity: 0.3, angle: 45, color: "#999999" },
  confidential: { text: "CONFIDENTIAL", opacity: 0.4, angle: 45, color: "#dc2626" },
  review: { text: "UNDER REVIEW", opacity: 0.35, angle: 45, color: "#f59e0b" },
  sample: { text: "SAMPLE", opacity: 0.25, angle: 45, color: "#3b82f6" },
  final: { text: "FINAL", opacity: 2, angle: 0, color: "#10b981" },
};

// ============================================================================
// Pagination & Headers/Footers
// ============================================================================

export interface PageHeader {
  id: string;
  left?: string;
  center?: string;
  right?: string;
  pages: "all" | "first-different" | "odd-even" | number[];
  font?: string;
  fontSize?: number;
}

export interface PageFooter {
  id: string;
  left?: string;
  center?: string;
  right?: string;
  includePageNumber: boolean;
  pageNumberStyle: "arabic" | "roman" | "alphabetic";
  pageNumberPosition: "left" | "center" | "right";
  startPage: number;
  pages: "all" | "first-different" | "odd-even" | number[];
}

// ============================================================================
// Page Footer / Header Rendering
// ============================================================================

export function renderPageFooterHTML(footer: PageFooter): string {
  const parts: { left?: string; center?: string; right?: string } = {
    left: footer.left || "",
    center: footer.center || "",
    right: footer.right || "",
  };

  if (footer.includePageNumber) {
    const pageCounter = `<span class="page-number" data-style="${footer.pageNumberStyle}"></span>`;
    parts[footer.pageNumberPosition] = [parts[footer.pageNumberPosition], pageCounter]
      .filter(Boolean)
      .join(" ");
  }

  return `<div class="page-footer" data-pages="${footer.pages}" data-start-page="${footer.startPage}">
    <span class="footer-left">${parts.left}</span>
    <span class="footer-center">${parts.center}</span>
    <span class="footer-right">${parts.right}</span>
  </div>`;
}

export function renderPageHeaderHTML(header: PageHeader): string {
  return `<div class="page-header" data-pages="${header.pages}">
    <span class="header-left">${header.left || ""}</span>
    <span class="header-center">${header.center || ""}</span>
    <span class="header-right">${header.right || ""}</span>
  </div>`;
}

export function generatePrintFooterCSS(): string {
  return `
    @media print {
      .page-footer { display: flex; justify-content: space-between; width: 100%; font-size: 10pt; }
      .page-header { display: flex; justify-content: space-between; width: 100%; font-size: 10pt; margin-bottom: 1em; }
      .page-number::after { content: counter(page); }
    }
  `;
}

// ============================================================================
// React Hook: Publishing
// ============================================================================

export function usePublishing(documentId?: string) {
  // Bibliography state
  const [entries, setEntries] = useState<BibliographyEntry[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [activeStyle, setActiveStyle] = useState<CitationStyle>("apa");
  
  // Index state
  const [indexEntries, setIndexEntries] = useState<IndexEntry[]>([]);
  const [autoMarkTerms, setAutoMarkTerms] = useState<string[]>([]);
  
  // TOC state
  const [tocEntries, setTocEntries] = useState<TOCEntry[]>([]);
  const [tocOptions, setTocOptions] = useState<TOCOptions>({
    maxDepth: 3,
    includeNumbers: true,
    numberStyle: "decimal",
    separator: ".",
  });
  
  // Cross-references
  const [references, setReferences] = useState<CrossReference[]>([]);
  const [targets, setTargets] = useState<ReferenceTarget[]>([]);
  
  // Footnotes
  const [footnotes, setFootnotes] = useState<Footnote[]>([]);
  const [notePlacement, setNotePlacement] = useState<NotePlacement>("footnote");
  
  // Margin notes
  const [marginNotes, setMarginNotes] = useState<MarginNote[]>([]);
  const [sidebars, setSidebars] = useState<Sidebar[]>([]);
  
  // Layout
  const [pageLayout, setPageLayout] = useState<PageLayout>(DEFAULT_PAGE_LAYOUT);
  
  // Watermarks
  const [watermarks, setWatermarks] = useState<Watermark[]>([]);
  
  // Headers/Footers
  const [headers, setHeaders] = useState<PageHeader[]>([]);
  const [footers, setFooters] = useState<PageFooter[]>([]);

  // ===================================================================
  // Bibliography Actions
  // ===================================================================
  
  const addEntry = useCallback((entry: Omit<BibliographyEntry, "id" | "usageCount">) => {
    const newEntry: BibliographyEntry = {
      ...entry,
      id: `bib-${Date.now()}`,
      usageCount: 0,
      formattedCitation: BIBLIOGRAPHY_STYLES[activeStyle].formatReference(entry as BibliographyEntry),
    };
    setEntries(prev => [...prev, newEntry]);
    return newEntry.id;
  }, [activeStyle]);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    setCitations(prev => prev.filter(c => c.entryId !== id));
  }, []);

  const cite = useCallback((entryId: string, location: string, options?: { suppressAuthor?: boolean; page?: string }) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return null;

    const citation: Citation = {
      id: `cite-${Date.now()}`,
      entryId,
      citationKey: entry.citationKey,
      location,
      position: 0,  // Would be set based on text insertion
      suppressAuthor: options?.suppressAuthor,
      pageNumber: options?.page,
    };

    setCitations(prev => [...prev, citation]);
    
    // Update entry usage count
    setEntries(prev => prev.map(e => 
      e.id === entryId 
        ? { ...e, usageCount: e.usageCount + 1, firstUsedIn: e.firstUsedIn || location }
        : e
    ));

    // Return formatted citation
    return BIBLIOGRAPHY_STYLES[activeStyle].formatCitation(entry, options);
  }, [entries, activeStyle]);

  const removeCitation = useCallback((citationId: string) => {
    const citation = citations.find(c => c.id === citationId);
    if (citation) {
      setCitations(prev => prev.filter(c => c.id !== citationId));
      setEntries(prev => prev.map(e => 
        e.id === citation.entryId 
          ? { ...e, usageCount: Math.max(0, e.usageCount - 1) }
          : e
      ));
    }
  }, [citations]);

  const generateBibliography = useCallback((): string => {
    const style = BIBLIOGRAPHY_STYLES[activeStyle];
    const usedEntries = entries.filter(e => e.usageCount > 0);
    
    // Sort based on style
    const sorted = [...usedEntries].sort((a, b) => 
      style.sortKey(a).localeCompare(style.sortKey(b))
    );

    return sorted.map(e => style.formatReference(e)).join("\n\n");
  }, [entries, activeStyle]);

  const entriesToBibTeX = useCallback((): string => {
    return entries.map(entry => {
      const fields = [
        `  author = {${entry.author}}`,
        `  title = {${entry.title}}`,
        `  year = {${entry.year}}`,
        entry.journal && `  journal = {${entry.journal}}`,
        entry.volume && `  volume = {${entry.volume}}`,
        entry.number && `  number = {${entry.number}}`,
        entry.pages && `  pages = {${entry.pages}}`,
        entry.doi && `  doi = {${entry.doi}}`,
        entry.url && `  url = {${entry.url}}`,
        entry.publisher && `  publisher = {${entry.publisher}}`,
      ].filter(Boolean).join(",\n");

      return `@${entry.type}{${entry.citationKey},\n${fields}\n}`;
    }).join("\n\n");
  }, [entries]);

  // ===================================================================
  // Index Actions
  // ===================================================================

  const markForIndex = useCallback((term: string, location: string, subterm?: string) => {
    const entry: IndexEntry = {
      id: `idx-${Date.now()}`,
      term: term.toLowerCase(),
      subterm,
      location,
      see: undefined,
      seeAlso: undefined,
    };
    setIndexEntries(prev => [...prev, entry]);
  }, []);

  const autoMark = useCallback((text: string, terms: string[], location: string) => {
    terms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      if (regex.test(text)) {
        markForIndex(term, location);
      }
    });
  }, [markForIndex]);

  const generateIndex = useCallback((): IndexCategory[] => {
    // Group by first letter
    const grouped = new Map<string, IndexEntry[]>();
    
    indexEntries.forEach(entry => {
      const letter = entry.term[0].toUpperCase();
      if (!grouped.has(letter)) grouped.set(letter, []);
      grouped.get(letter)!.push(entry);
    });

    // Sort each group
    const sorted = new Map<string, IndexEntry[]>();
    grouped.forEach((entries, letter) => {
      sorted.set(letter, entries.sort((a, b) => a.term.localeCompare(b.term)));
    });

    return Array.from(sorted.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([letter, entries]) => ({ letter, entries }));
  }, [indexEntries]);

  // ===================================================================
  // TOC Actions
  // ===================================================================

  const generateTOC = useCallback((nodes: HDSINode[]): TOCEntry[] => {
    const toc: TOCEntry[] = [];
    let chapterCount = 0;
    let sectionCount = 0;
    let subsectionCount = 0;

    const processNode = (node: HDSINode, depth: number) => {
      if (depth > tocOptions.maxDepth) return;

      let number = "";
      if (tocOptions.includeNumbers) {
        if (node.type === "chapter") {
          chapterCount++;
          sectionCount = 0;
          subsectionCount = 0;
          number = tocOptions.numberStyle === "roman" 
            ? toRoman(chapterCount)
            : chapterCount.toString();
        } else if (node.type === "section") {
          sectionCount++;
          subsectionCount = 0;
          number = `${chapterCount}${tocOptions.separator}${sectionCount}`;
        } else if (node.type === "subsection") {
          subsectionCount++;
          number = `${chapterCount}${tocOptions.separator}${sectionCount}${tocOptions.separator}${subsectionCount}`;
        }
      }

      const entry: TOCEntry = {
        id: `toc-${node.id}`,
        level: depth,
        title: number ? `${number} ${node.title}` : node.title,
        nodeId: node.id,
        children: [],
      };

      if (depth === 0 || !tocOptions.includeNumbers) {
        toc.push(entry);
      } else {
        // Find parent and add as child
        const parent = toc.find(e => e.level === depth - 1 && !e.children?.find(c => c.nodeId === node.parentId));
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(entry);
        } else {
          toc.push(entry);
        }
      }
    };

    nodes.forEach(node => processNode(node, node.depth || 0));
    return toc;
  }, [tocOptions]);

  // ===================================================================
  // Watermark Actions
  // ===================================================================

  const addWatermark = useCallback((preset: WatermarkPreset | Partial<Watermark>) => {
    let watermark: Watermark;
    
    if (typeof preset === "string") {
      const presetData = WATERMARK_PRESETS[preset];
      watermark = {
        id: `wm-${Date.now()}`,
        text: presetData.text!,
        opacity: presetData.opacity!,
        angle: presetData.angle!,
        color: presetData.color!,
        pages: "all",
        position: "diagonal",
        fontSize: 72,
      };
    } else {
      watermark = {
        id: `wm-${Date.now()}`,
        text: "",
        opacity: 0.3,
        angle: 45,
        color: "#999999",
        pages: "all",
        position: "diagonal",
        fontSize: 72,
        ...preset,
      };
    }
    
    setWatermarks(prev => [...prev, watermark]);
    return watermark.id;
  }, []);

  const removeWatermark = useCallback((id: string) => {
    setWatermarks(prev => prev.filter(w => w.id !== id));
  }, []);

  // ===================================================================
  // Getters
  // ===================================================================

  const usedCitations = useMemo(() => {
    return entries.filter(e => e.usageCount > 0);
  }, [entries]);

  return {
    // Bibliography
    entries,
    citations,
    activeStyle,
    setActiveStyle,
    addEntry,
    removeEntry,
    cite,
    removeCitation,
    generateBibliography,
    entriesToBibTeX,
    usedCitations,
    availableStyles: Object.keys(BIBLIOGRAPHY_STYLES) as CitationStyle[],
    
    // Index
    indexEntries,
    markForIndex,
    autoMark,
    generateIndex,
    autoMarkTerms,
    setAutoMarkTerms,
    
    // TOC
    tocEntries,
    tocOptions,
    setTocOptions,
    generateTOC,
    
    // References
    references,
    targets,
    addTarget: (target: ReferenceTarget) => setTargets(prev => [...prev, target]),
    addReference: (ref: CrossReference) => setReferences(prev => [...prev, ref]),
    
    // Footnotes
    footnotes,
    setFootnotes,
    notePlacement,
    setNotePlacement,
    
    // Margin notes
    marginNotes,
    sidebars,
    addMarginNote: (note: MarginNote) => setMarginNotes(prev => [...prev, note]),
    addSidebar: (sidebar: Sidebar) => setSidebars(prev => [...prev, sidebar]),
    
    // Layout
    pageLayout,
    setPageLayout,
    
    // Watermarks
    watermarks,
    addWatermark,
    removeWatermark,
    applyPreset: addWatermark,
    
    // Headers/Footers
    headers,
    footers,
    setHeaders,
    setFooters,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function toRoman(num: number): string {
  const roman = {
    M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90,
    L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let str = "";
  for (const [letter, value] of Object.entries(roman)) {
    while (num >= value) {
      str += letter;
      num -= value;
    }
  }
  return str;
}

// ============================================================================
// Export Functions
// ============================================================================

export function generateLaTeXHeader(options: {
  documentClass?: string;
  classOptions?: string[];
  packages?: string[];
  title?: string;
  author?: string;
  date?: string;
  pageLayout?: PageLayout;
}): string {
  const {
    documentClass = "article",
    classOptions = ["12pt"],
    packages = [],
    title,
    author,
    date,
    pageLayout,
  } = options;

  let header = `\\documentclass[${classOptions.join(",")}]{${documentClass}}\n\n`;

  // Required packages
  const requiredPackages = [
    "inputenc",
    "fontenc",
    "graphicx",
    "hyperref",
    "geometry",
    "fancyhdr",
    "lastpage",
    "biblatex",
    "index",
    "imakeidx",
    "tocloft",
    "caption",
    "subcaption",
    "booktabs",
    "xcolor",
    "watermark",
    "draftwatermark",
    ...packages,
  ];
  
  requiredPackages.forEach(pkg => {
    header += `\\usepackage{${pkg}}\n`;
  });

  // Page layout
  if (pageLayout) {
    const { margins, columns } = pageLayout;
    header += `\n\\geometry{top=${margins.top}mm, bottom=${margins.bottom}mm, left=${margins.left}mm, right=${margins.right}mm}\n`;
    if (columns === 2) {
      header += `\\twocolumn\n`;
    }
  }

  // Title info
  if (title) header += `\\title{${title}}\n`;
  if (author) header += `\\author{${author}}\n`;
  if (date) header += `\\date{${date}}\n`;

  header += `\n\\begin{document}\n`;
  if (title) header += `\\maketitle\n`;

  return header;
}

export function generateLaTeXFooter(): string {
  return "\n\\end{document}";
}

export function pageLayoutToCSS(layout: PageLayout): string {
  const { size, orientation, margins } = layout;
  
  const sizeMap: Record<PageSize, string> = {
    letter: "8.5in 11in",
    legal: "8.5in 14in",
    a4: "210mm 297mm",
    a5: "148mm 210mm",
    custom: "8.5in 11in",
  };

  return `
@page {
  size: ${sizeMap[size]} ${orientation};
  margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
}
`;
}
