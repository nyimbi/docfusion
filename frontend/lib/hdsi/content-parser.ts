/**
 * Content-to-Structure Parser for HDSI
 *
 * Parses existing document content (plain text, Tiptap JSON, HTML, Markdown)
 * into HDSINode tree structure for editing in the HDSI editor.
 *
 * Detection strategies:
 * 1. Heading-based: H1 → chapter, H2 → section, H3 → subsection
 * 2. Markdown-based: # → chapter, ## → section, ### → subsection
 * 3. Pattern-based: "Chapter X", "Section X.Y", numbered lists
 * 4. AI-assisted: Use AI to infer structure from unstructured text
 */

import type { HDSINode } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface ParsedSection {
  title: string;
  level: number; // 1 = chapter, 2 = section, 3 = subsection
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface ParseOptions {
  /** Use AI to enhance structure detection */
  useAI?: boolean;
  /** Minimum content length to create a section (chars) */
  minSectionLength?: number;
  /** Maximum depth of nesting (1-3) */
  maxDepth?: number;
  /** Document title for context */
  documentTitle?: string;
}

export interface ParseResult {
  nodes: HDSINode[];
  /** Sections that couldn't be parsed */
  orphanedContent?: string;
  /** Parsing confidence (0-1) */
  confidence: number;
  /** Method used for parsing */
  method: "heading" | "markdown" | "pattern" | "ai" | "fallback";
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse document content into HDSINode structure.
 * Automatically detects content format and applies appropriate parsing strategy.
 */
export function parseContentToStructure(
  content: unknown,
  options: ParseOptions = {}
): ParseResult {
  const {
    minSectionLength = 50,
    maxDepth = 3,
    documentTitle = "Document",
  } = options;

  // Extract plain text from various formats
  const { text, format } = extractTextContent(content);

  if (!text || text.trim().length < minSectionLength) {
    return {
      nodes: [],
      orphanedContent: text,
      confidence: 0,
      method: "fallback",
    };
  }

  // Try different parsing strategies in order of reliability
  let result: ParseResult;

  // 1. Try Tiptap/HTML heading-based parsing
  if (format === "tiptap" || format === "html") {
    result = parseFromTiptap(content as TiptapDoc, options);
    if (result.confidence > 0.7) return result;
  }

  // 2. Try Markdown heading parsing
  result = parseFromMarkdown(text, options);
  if (result.confidence > 0.6) return result;

  // 3. Try pattern-based parsing (Chapter X, Section Y)
  result = parseFromPatterns(text, options);
  if (result.confidence > 0.5) return result;

  // 4. Fallback: Create single section or use paragraph breaks
  result = parseFromParagraphs(text, documentTitle, options);
  return result;
}

// ============================================================================
// Content Extraction
// ============================================================================

type ContentFormat = "tiptap" | "html" | "markdown" | "plain";

interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

function extractTextContent(content: unknown): { text: string; format: ContentFormat } {
  if (!content) {
    return { text: "", format: "plain" };
  }

  // Handle string content
  if (typeof content === "string") {
    // Check if it's JSON
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === "doc" && Array.isArray(parsed.content)) {
        return { text: extractFromTiptap(parsed), format: "tiptap" };
      }
    } catch {
      // Not JSON, check format
    }

    // Check if Markdown
    if (/^#{1,6}\s/m.test(content) || /^\*\*|^\-\s|^\d+\.\s/m.test(content)) {
      return { text: content, format: "markdown" };
    }

    // Check if HTML
    if (/<[a-z][\s\S]*>/i.test(content)) {
      return { text: stripHtml(content), format: "html" };
    }

    return { text: content, format: "plain" };
  }

  // Handle Tiptap JSON object
  if (typeof content === "object" && content !== null) {
    const obj = content as Record<string, unknown>;
    if (obj.type === "doc" && Array.isArray(obj.content)) {
      return { text: extractFromTiptap(obj as unknown as TiptapDoc), format: "tiptap" };
    }
  }

  return { text: String(content), format: "plain" };
}

function extractFromTiptap(doc: TiptapDoc): string {
  const extractNode = (node: TiptapNode): string => {
    if (node.text) return node.text;
    if (!node.content) return "";

    const childText = node.content.map(extractNode).join("");

    // Add structure markers based on node type
    switch (node.type) {
      case "heading":
        const level = (node.attrs?.level as number) || 1;
        return `\n${"#".repeat(level)} ${childText}\n`;
      case "paragraph":
        return `${childText}\n\n`;
      case "bulletList":
      case "orderedList":
        return `${childText}\n`;
      case "listItem":
        return `- ${childText}\n`;
      case "blockquote":
        return `> ${childText}\n`;
      case "codeBlock":
        return `\`\`\`\n${childText}\n\`\`\`\n`;
      default:
        return childText;
    }
  };

  return doc.content.map(extractNode).join("").trim();
}

function stripHtml(html: string): string {
  // Convert HTML to text while preserving structure
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

// ============================================================================
// Parsing Strategies
// ============================================================================

/**
 * Parse from Tiptap JSON structure (preserves heading hierarchy)
 */
function parseFromTiptap(doc: TiptapDoc, options: ParseOptions): ParseResult {
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let position = 0;

  const processNode = (node: TiptapNode) => {
    if (node.type === "heading") {
      // Save current section if exists
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }

      const level = Math.min((node.attrs?.level as number) || 1, options.maxDepth || 3);
      const title = node.content?.map(n => n.text || "").join("") || "Untitled";

      currentSection = {
        title,
        level,
        content: "",
        startIndex: position,
        endIndex: position,
      };
    } else if (currentSection) {
      // Add content to current section
      const nodeText = extractNodeText(node);
      currentSection.content += nodeText;
      currentSection.endIndex = position + nodeText.length;
    } else if (node.type === "paragraph" || node.type === "bulletList") {
      // Content before first heading - create intro section
      const nodeText = extractNodeText(node);
      if (nodeText.trim()) {
        currentSection = {
          title: "Introduction",
          level: 1,
          content: nodeText,
          startIndex: 0,
          endIndex: nodeText.length,
        };
      }
    }
    position++;
  };

  doc.content.forEach(processNode);

  // Don't forget last section (TypeScript can't track mutations through forEach callback)
  const lastSection = currentSection as ParsedSection | null;
  if (lastSection && lastSection.content.trim()) {
    sections.push(lastSection);
  }

  if (sections.length === 0) {
    return {
      nodes: [],
      confidence: 0,
      method: "heading",
    };
  }

  const nodes = buildNodeTree(sections, options);

  return {
    nodes,
    confidence: sections.length > 1 ? 0.9 : 0.6,
    method: "heading",
  };
}

function extractNodeText(node: TiptapNode): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(extractNodeText).join("");
}

/**
 * Parse from Markdown headings
 */
function parseFromMarkdown(text: string, options: ParseOptions): ParseResult {
  const sections: ParsedSection[] = [];
  const maxDepth = options.maxDepth || 3;

  // Match markdown headings
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const matches = [...text.matchAll(headingRegex)];

  if (matches.length === 0) {
    return {
      nodes: [],
      confidence: 0,
      method: "markdown",
    };
  }

  // Parse each heading and its content
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const level = Math.min(match[1].length, maxDepth);
    const title = match[2].trim();
    const startIndex = match.index!;

    // Content is everything until next heading or end
    const nextMatch = matches[i + 1];
    const endIndex = nextMatch ? nextMatch.index! : text.length;
    const content = text
      .slice(startIndex + match[0].length, endIndex)
      .trim();

    sections.push({
      title,
      level,
      content,
      startIndex,
      endIndex,
    });
  }

  // Check for content before first heading
  if (matches[0].index! > 0) {
    const preContent = text.slice(0, matches[0].index!).trim();
    if (preContent.length > (options.minSectionLength || 50)) {
      sections.unshift({
        title: "Introduction",
        level: 1,
        content: preContent,
        startIndex: 0,
        endIndex: matches[0].index!,
      });
    }
  }

  const nodes = buildNodeTree(sections, options);

  return {
    nodes,
    confidence: matches.length > 2 ? 0.85 : 0.65,
    method: "markdown",
  };
}

/**
 * Parse from common patterns like "Chapter 1:", "Section 2.1", "1. Introduction"
 */
function parseFromPatterns(text: string, options: ParseOptions): ParseResult {
  const sections: ParsedSection[] = [];

  // Pattern definitions with their heading levels
  const patterns = [
    // "Chapter 1: Title" or "CHAPTER ONE"
    { regex: /^(?:CHAPTER|Chapter)\s+(?:\d+|[A-Z]+)[:\.]?\s*(.*)$/gm, level: 1 },
    // "Section 1.1" or "SECTION 2"
    { regex: /^(?:SECTION|Section)\s+[\d.]+[:\.]?\s*(.*)$/gm, level: 2 },
    // "1. Title" or "1.1 Title" at start of line
    { regex: /^(\d+(?:\.\d+)*)[:\.\)]\s+([A-Z][^\n]+)$/gm, level: (m: RegExpMatchArray) => {
      const num = m[1];
      return Math.min(num.split(".").length, 3);
    }},
    // Roman numerals "I. Title", "II. Title"
    { regex: /^([IVXLC]+)[:\.\)]\s+([A-Z][^\n]+)$/gm, level: 1 },
    // Letter sections "A. Title", "B. Title"
    { regex: /^([A-Z])[:\.\)]\s+([A-Z][^\n]+)$/gm, level: 2 },
  ];

  let allMatches: Array<{ match: RegExpMatchArray; level: number; title: string }> = [];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern.regex)];
    for (const match of matches) {
      const level = typeof pattern.level === "function" ? pattern.level(match) : pattern.level;
      const title = match[2] || match[1] || match[0].replace(/^[\d\.\:\)\s]+/, "").trim();
      allMatches.push({ match, level, title });
    }
  }

  if (allMatches.length === 0) {
    return {
      nodes: [],
      confidence: 0,
      method: "pattern",
    };
  }

  // Sort by position in text
  allMatches.sort((a, b) => (a.match.index || 0) - (b.match.index || 0));

  // Build sections
  for (let i = 0; i < allMatches.length; i++) {
    const { match, level, title } = allMatches[i];
    const startIndex = match.index!;
    const nextMatch = allMatches[i + 1];
    const endIndex = nextMatch ? nextMatch.match.index! : text.length;
    const content = text.slice(startIndex + match[0].length, endIndex).trim();

    sections.push({
      title: title.trim(),
      level,
      content,
      startIndex,
      endIndex,
    });
  }

  const nodes = buildNodeTree(sections, options);

  return {
    nodes,
    confidence: allMatches.length > 2 ? 0.7 : 0.5,
    method: "pattern",
  };
}

/**
 * Fallback: Parse from paragraph breaks, creating sections from large text blocks
 */
function parseFromParagraphs(
  text: string,
  documentTitle: string,
  options: ParseOptions
): ParseResult {
  const minLength = options.minSectionLength || 50;

  // Split by double newlines (paragraph breaks)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  if (paragraphs.length <= 1) {
    // Single block of text - create one section
    return {
      nodes: [{
        id: crypto.randomUUID(),
        title: documentTitle || "Content",
        type: "chapter",
        order: 0,
        expanded: true,
        customPrompt: "",
        tokenBudget: Math.min(text.length / 4, 2000),
        densityTarget: 3,
        coherenceScore: 1,
        status: "generated",
        depth: 0,
        parentId: null,
        generatedContent: text.trim(),
        children: [],
      }],
      confidence: 0.3,
      method: "fallback",
    };
  }

  // Group paragraphs into sections (every 3-5 paragraphs or by length)
  const sections: ParsedSection[] = [];
  let currentContent = "";
  let sectionCount = 0;

  for (const para of paragraphs) {
    currentContent += para + "\n\n";

    // Create section if content is substantial
    if (currentContent.length > 800 || (currentContent.length > 400 && paragraphs.length > 10)) {
      sectionCount++;
      sections.push({
        title: `Section ${sectionCount}`,
        level: 2,
        content: currentContent.trim(),
        startIndex: 0,
        endIndex: 0,
      });
      currentContent = "";
    }
  }

  // Add remaining content
  if (currentContent.trim().length > minLength) {
    sectionCount++;
    sections.push({
      title: `Section ${sectionCount}`,
      level: 2,
      content: currentContent.trim(),
      startIndex: 0,
      endIndex: 0,
    });
  }

  // Wrap in a chapter
  const nodes: HDSINode[] = [{
    id: crypto.randomUUID(),
    title: documentTitle || "Document",
    type: "chapter",
    order: 0,
    expanded: true,
    customPrompt: "",
    tokenBudget: 500,
    densityTarget: 3,
    coherenceScore: 1,
    status: "outline",
    depth: 0,
    parentId: null,
    generatedContent: "",
    children: sections.map((section, idx) => ({
      id: crypto.randomUUID(),
      title: section.title,
      type: "section" as const,
      order: idx,
      expanded: true,
      customPrompt: "",
      tokenBudget: Math.min(section.content.length / 4, 1000),
      densityTarget: 3,
      coherenceScore: 1,
      status: "generated" as const,
      depth: 1,
      parentId: null,
      generatedContent: section.content,
      children: [],
    })),
  }];

  return {
    nodes,
    confidence: 0.4,
    method: "fallback",
  };
}

// ============================================================================
// Tree Building
// ============================================================================

/**
 * Build HDSINode tree from flat section list
 */
function buildNodeTree(sections: ParsedSection[], options: ParseOptions): HDSINode[] {
  if (sections.length === 0) return [];

  const nodes: HDSINode[] = [];
  const stack: { node: HDSINode; level: number }[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    const node: HDSINode = {
      id: crypto.randomUUID(),
      title: section.title,
      type: levelToType(section.level),
      order: i,
      expanded: true,
      customPrompt: "",
      tokenBudget: Math.min(Math.max(section.content.length / 4, 300), 2000),
      densityTarget: 3,
      coherenceScore: 1,
      status: section.content.trim() ? "generated" : "outline",
      depth: section.level - 1,
      parentId: null,
      generatedContent: section.content.trim(),
      children: [],
    };

    // Find parent based on level
    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level node
      nodes.push(node);
    } else {
      // Child of current stack top
      const parent = stack[stack.length - 1].node;
      node.depth = parent.depth + 1;
      node.parentId = parent.id;
      parent.children.push(node);
    }

    stack.push({ node, level: section.level });
  }

  return nodes;
}

function levelToType(level: number): HDSINode["type"] {
  switch (level) {
    case 1:
      return "chapter";
    case 2:
      return "section";
    default:
      return "subsection";
  }
}

// ============================================================================
// AI-Assisted Parsing (for unstructured text)
// ============================================================================

/**
 * Use AI to infer document structure from unstructured text
 */
export async function parseWithAI(
  text: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const { documentTitle = "Document" } = options;

  try {
    const response = await fetch("/api/v1/ai/completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are a document structure analyzer. Analyze the following text and identify its logical sections.

Return a JSON array where each element represents a section with:
- "title": A descriptive title for the section
- "level": 1 for main topics/chapters, 2 for subtopics/sections, 3 for details/subsections
- "startPhrase": The first 10-20 words of this section (for locating it)
- "endPhrase": The last 10-20 words of this section

Rules:
- Create 3-10 sections depending on content length
- Level 1 sections should cover major themes
- Nest related content appropriately
- Title should describe the content, not just "Section 1"

Return ONLY the JSON array, no explanation.`,
          },
          {
            role: "user",
            content: `Document title: "${documentTitle}"\n\nContent:\n${text.slice(0, 8000)}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error("AI parsing failed");
    }

    const data = await response.json();
    const aiSections = JSON.parse(data.content);

    // Convert AI output to ParsedSection format
    const sections: ParsedSection[] = [];

    for (const aiSection of aiSections) {
      const startIdx = text.indexOf(aiSection.startPhrase);
      const endIdx = aiSection.endPhrase
        ? text.indexOf(aiSection.endPhrase) + aiSection.endPhrase.length
        : text.length;

      if (startIdx !== -1) {
        sections.push({
          title: aiSection.title,
          level: aiSection.level,
          content: text.slice(startIdx, endIdx > startIdx ? endIdx : undefined).trim(),
          startIndex: startIdx,
          endIndex: endIdx,
        });
      }
    }

    if (sections.length === 0) {
      throw new Error("No sections identified");
    }

    const nodes = buildNodeTree(sections, options);

    return {
      nodes,
      confidence: 0.75,
      method: "ai",
    };
  } catch (error) {
    console.error("AI parsing error:", error);
    // Fallback to paragraph parsing
    return parseFromParagraphs(text, documentTitle, options);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Merge parsed structure with existing nodes (for incremental updates)
 */
export function mergeStructures(
  existing: HDSINode[],
  parsed: HDSINode[]
): HDSINode[] {
  // If no existing structure, use parsed
  if (existing.length === 0) return parsed;

  // If no parsed structure, keep existing
  if (parsed.length === 0) return existing;

  // For now, replace entirely - could be enhanced to do smart merging
  return parsed;
}

/**
 * Estimate the quality of structure detection
 */
export function assessParseQuality(result: ParseResult): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = result.confidence;

  // Check for issues
  if (result.nodes.length === 0) {
    issues.push("No structure detected");
    suggestions.push("Try adding headings to your content");
    score = 0;
  } else if (result.nodes.length === 1 && result.nodes[0].children.length === 0) {
    issues.push("Only single section detected");
    suggestions.push("Consider breaking content into multiple sections");
    score *= 0.7;
  }

  // Check for balanced structure
  const maxDepth = getMaxDepth(result.nodes);
  if (maxDepth === 1) {
    suggestions.push("Consider adding subsections for better organization");
    score *= 0.9;
  }

  // Check for content coverage
  const nodesWithContent = countNodesWithContent(result.nodes);
  const totalNodes = countTotalNodes(result.nodes);
  if (nodesWithContent / totalNodes < 0.5) {
    issues.push("Many sections lack content");
    score *= 0.8;
  }

  return { score, issues, suggestions };
}

function getMaxDepth(nodes: HDSINode[], currentDepth = 1): number {
  let maxDepth = currentDepth;
  for (const node of nodes) {
    if (node.children.length > 0) {
      maxDepth = Math.max(maxDepth, getMaxDepth(node.children, currentDepth + 1));
    }
  }
  return maxDepth;
}

function countNodesWithContent(nodes: HDSINode[]): number {
  return nodes.reduce((acc, node) => {
    const hasContent = node.generatedContent && node.generatedContent.trim().length > 0;
    return acc + (hasContent ? 1 : 0) + countNodesWithContent(node.children);
  }, 0);
}

function countTotalNodes(nodes: HDSINode[]): number {
  return nodes.reduce((acc, node) => acc + 1 + countTotalNodes(node.children), 0);
}
