"use client";

/**
 * Automatic Index Generation
 * 
 * Generates document index from:
 * - Marked terms in content
 * - Defined vocabulary/acronyms
 * - Auto-extracted key terms
 */

import type { HDSINode } from "./types";
import type { IndexEntry, IndexCategory } from "./publishing";

export interface AutoIndexOptions {
  /** Include automatically extracted terms */
  includeAutoTerms?: boolean;
  /** Minimum term length */
  minTermLength?: number;
  /** Terms to exclude */
  excludeTerms?: string[];
  /** Case sensitivity */
  caseSensitive?: boolean;
}

const COMMON_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
  "is", "was", "are", "were", "been", "has", "had", "did", "does", "doing",
  // Common business terms to exclude from auto-index
  "company", "business", "organization", "project", "document", "section", "page",
  "figure", "table", "appendix", "reference", "introduction", "conclusion",
]);

/**
 * Generate index from document structure
 */
export function generateAutoIndex(
  nodes: HDSINode[],
  markedEntries: IndexEntry[] = [],
  options: AutoIndexOptions = {}
): IndexCategory[] {
  const {
    includeAutoTerms = true,
    minTermLength = 4,
    excludeTerms = [],
    caseSensitive = false,
  } = options;

  const allEntries = [...markedEntries];

  if (includeAutoTerms) {
    const extractedTerms = extractTermsFromNodes(nodes, {
      minTermLength,
      excludeTerms: [...excludeTerms, ...Array.from(COMMON_WORDS)],
      caseSensitive,
    });
    allEntries.push(...extractedTerms);
  }

  return categorizeAndSortEntries(allEntries);
}

/**
 * Extract potential index terms from document content
 */
function extractTermsFromNodes(
  nodes: HDSINode[],
  options: {
    minTermLength: number;
    excludeTerms: string[];
    caseSensitive: boolean;
  }
): IndexEntry[] {
  const terms = new Map<string, IndexEntry>();

  const processNode = (node: HDSINode, nodePath: string) => {
    // Extract from title
    extractTerms(node.title, node.id, nodePath, terms, options);

    // Extract from content
    if (node.generatedContent) {
      extractTerms(node.generatedContent, node.id, nodePath, terms, options);
    }

    // Process children
    if (node.children) {
      node.children.forEach((child, i) => {
        processNode(child, `${nodePath}.${i + 1}`);
      });
    }
  };

  nodes.forEach((node, i) => processNode(node, `${i + 1}`));

  return Array.from(terms.values());
}

function extractTerms(
  text: string,
  nodeId: string,
  location: string,
  terms: Map<string, IndexEntry>,
  options: {
    minTermLength: number;
    excludeTerms: string[];
    caseSensitive: boolean;
  }
): void {
  // Look for:
  // 1. Capitalized phrases (potential proper nouns)
  // 2. Terms in quotes
  // 3. Acronyms (2-5 uppercase letters)
  // 4. Technical terms (lowercase with specific patterns)

  const patterns = [
    // Capitalized phrases (2-4 words)
    /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\b/g,
    // Quoted terms
    /"([^"]{3,50})"/g,
    // Acronyms
    /\b([A-Z]{2,5})\b/g,
    // Technical terms with numbers
    /\b([a-z]+[0-9][a-z0-9]*)\b/gi,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const term = match[1].trim();
      const normalizedTerm = options.caseSensitive ? term : term.toLowerCase();

      if (
        term.length >= options.minTermLength &&
        !options.excludeTerms.some((ex) => 
          normalizedTerm === (options.caseSensitive ? ex : ex.toLowerCase())
        )
      ) {
        const existing = terms.get(normalizedTerm);
        if (existing) {
          // Add location if not already present
          if (!existing.location.includes(location)) {
            existing.location += `, ${location}`;
          }
        } else {
          terms.set(normalizedTerm, {
            id: `auto-${normalizedTerm.replace(/\s+/g, "-")}`,
            term: term,
            location: location,
          });
        }
      }
    }
  });
}

/**
 * Categorize entries by first letter and sort
 */
function categorizeAndSortEntries(entries: IndexEntry[]): IndexCategory[] {
  const grouped = new Map<string, IndexEntry[]>();

  entries.forEach((entry) => {
    const firstChar = entry.term.charAt(0).toUpperCase();
    const letter = /^[A-Z]$/i.test(firstChar) ? firstChar : "#";

    if (!grouped.has(letter)) {
      grouped.set(letter, []);
    }
    grouped.get(letter)!.push(entry);
  });

  // Sort entries within each category
  grouped.forEach((categoryEntries) => {
    categoryEntries.sort((a, b) => a.term.localeCompare(b.term));
  });

  // Convert to sorted array
  const sortedLetters = Array.from(grouped.keys()).sort();
  
  return sortedLetters.map((letter) => ({
    letter,
    entries: grouped.get(letter)!,
  }));
}

/**
 * Format index for export
 */
export function formatIndex(
  categories: IndexCategory[],
  format: "text" | "html" | "markdown" = "text"
): string {
  switch (format) {
    case "html":
      return formatIndexAsHTML(categories);
    case "markdown":
      return formatIndexAsMarkdown(categories);
    default:
      return formatIndexAsText(categories);
  }
}

function formatIndexAsText(categories: IndexCategory[]): string {
  let result = "INDEX\n" + "=".repeat(40) + "\n\n";

  categories.forEach((category) => {
    result += `${category.letter}\n`;
    result += "-".repeat(category.letter.length) + "\n";
    
    category.entries.forEach((entry) => {
      result += `${entry.term}`;
      if (entry.subterm) {
        result += ` — ${entry.subterm}`;
      }
      result += ` .................... ${entry.location}\n`;
      
      if (entry.see) {
        result += `    See: ${entry.see}\n`;
      }
      if (entry.seeAlso?.length) {
        result += `    See also: ${entry.seeAlso.join(", ")}\n`;
      }
    });
    
    result += "\n";
  });

  return result;
}

function formatIndexAsHTML(categories: IndexCategory[]): string {
  let html = '<div class="document-index">\n<h2>Index</h2>\n';

  // Navigation links
  html += '<nav class="index-nav">';
  categories.forEach((cat) => {
    html += `<a href="#index-${cat.letter}">${cat.letter}</a> `;
  });
  html += "</nav>\n";

  html += '<div class="index-content">\n';
  categories.forEach((category) => {
    html += `<section id="index-${category.letter}">\n`;
    html += `<h3>${category.letter}</h3>\n<ul>\n`;
    
    category.entries.forEach((entry) => {
      html += "  <li>";
      html += `<strong>${escapeHtml(entry.term)}</strong>`;
      if (entry.subterm) {
        html += ` — ${escapeHtml(entry.subterm)}`;
      }
      html += ` <span class="location">${entry.location}</span>`;
      
      if (entry.see) {
        html += `<br><small>See: ${escapeHtml(entry.see)}</small>`;
      }
      if (entry.seeAlso?.length) {
        html += `<br><small>See also: ${entry.seeAlso.map(escapeHtml).join(", ")}</small>`;
      }
      html += "</li>\n";
    });
    
    html += "</ul>\n</section>\n";
  });
  html += "</div>\n</div>";

  return html;
}

function formatIndexAsMarkdown(categories: IndexCategory[]): string {
  let md = "# Index\n\n";

  // Table of letters
  md += categories.map((c) => `[${c.letter}](#${c.letter.toLowerCase()})`).join(" · ");
  md += "\n\n---\n\n";

  categories.forEach((category) => {
    md += `## <a name="${category.letter.toLowerCase()}"></a>${category.letter}\n\n`;
    
    category.entries.forEach((entry) => {
      let line = `- **${entry.term}**`;
      if (entry.subterm) {
        line += ` — ${entry.subterm}`;
      }
      line += ` (${entry.location})`;
      
      if (entry.see) {
        line += `\n  - See: ${entry.see}`;
      }
      if (entry.seeAlso?.length) {
        line += `\n  - See also: ${entry.seeAlso.join(", ")}`;
      }
      md += line + "\n";
    });
    
    md += "\n";
  });

  return md;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Find all diagrams in document structure
 */
export function findDiagrams(nodes: HDSINode[]): Array<{
  id: string;
  title: string;
  type: string;
  location: string;
  nodeId: string;
}> {
  const diagrams: Array<{
    id: string;
    title: string;
    type: string;
    location: string;
    nodeId: string;
  }> = [];

  const processNode = (node: HDSINode, path: string, depth: number) => {
    // Check for diagram references in content
    if (node.generatedContent) {
      // Look for diagram/image references
      const diagramRegex = /\[Diagram:\s*([^\]]+)\]|\[Figure:\s*([^\]]+)\]|!\[([^\]]*)\]\(([^)]+)\)/gi;
      let match;
      while ((match = diagramRegex.exec(node.generatedContent)) !== null) {
        const title = match[1] || match[2] || match[3] || "Untitled Diagram";
        const type = match[4]?.split(".").pop() || "image";
        
        diagrams.push({
          id: `diagram-${diagrams.length + 1}`,
          title: title,
          type: type.toLowerCase(),
          location: `${path} ${node.title}`,
          nodeId: node.id,
        });
      }
    }

    // Check for diagram data in node metadata
    if (node.diagramData) {
      diagrams.push({
        id: `diagram-${diagrams.length + 1}`,
        title: node.diagramData.name || `${node.title} Diagram`,
        type: node.diagramData.format || "unknown",
        location: `${path} ${node.title}`,
        nodeId: node.id,
      });
    }

    // Process children
    if (node.children) {
      node.children.forEach((child, i) => {
        processNode(child, `${path}.${i + 1}`, depth + 1);
      });
    }
  };

  nodes.forEach((node, i) => processNode(node, `${i + 1}`, 0));

  return diagrams;
}

/**
 * Generate table of diagrams
 */
export function generateTableOfDiagrams(
  nodes: HDSINode[],
  format: "text" | "html" | "markdown" = "text"
): string {
  const diagrams = findDiagrams(nodes);

  if (diagrams.length === 0) {
    return "";
  }

  switch (format) {
    case "html":
      return formatDiagramsAsHTML(diagrams);
    case "markdown":
      return formatDiagramsAsMarkdown(diagrams);
    default:
      return formatDiagramsAsText(diagrams);
  }
}

function formatDiagramsAsText(diagrams: ReturnType<typeof findDiagrams>): string {
  let result = "LIST OF DIAGRAMS\n" + "=".repeat(40) + "\n\n";
  
  diagrams.forEach((diagram, i) => {
    result += `Figure ${i + 1}: ${diagram.title}\n`;
    result += `  Type: ${diagram.type.toUpperCase()}\n`;
    result += `  Location: ${diagram.location}\n\n`;
  });

  return result;
}

function formatDiagramsAsHTML(diagrams: ReturnType<typeof findDiagrams>): string {
  let html = '<div class="table-of-diagrams">\n<h2>List of Diagrams</h2>\n<table>\n';
  html += "<thead><tr><th>No.</th><th>Title</th><th>Type</th><th>Location</th></tr></thead>\n<tbody>\n";
  
  diagrams.forEach((diagram, i) => {
    html += `<tr>`;
    html += `<td>${i + 1}</td>`;
    html += `<td>${escapeHtml(diagram.title)}</td>`;
    html += `<td>${diagram.type}</td>`;
    html += `<td>${escapeHtml(diagram.location)}</td>`;
    html += `</tr>\n`;
  });
  
  html += "</tbody>\n</table>\n</div>";
  return html;
}

function formatDiagramsAsMarkdown(diagrams: ReturnType<typeof findDiagrams>): string {
  let md = "# List of Diagrams\n\n";
  md += "| No. | Title | Type | Location |\n";
  md += "|-----|-------|------|----------|\n";
  
  diagrams.forEach((diagram, i) => {
    md += `| ${i + 1} | ${diagram.title} | ${diagram.type} | ${diagram.location} |\n`;
  });

  return md;
}
