"use client";

/**
 * Template Importer - AI-Powered Document to Template Conversion
 *
 * Analyzes existing documents to extract structure and generate
 * reusable templates with AI prompts for each section.
 */

import type { DocumentTemplate, TemplateNode, TemplateCategory } from "./templates";

// ============================================================================
// Types for Import Process
// ============================================================================

export interface ImportedSection {
  level: number;                    // 0=chapter, 1=section, 2=subsection, etc.
  title: string;
  originalContent: string;          // The actual content from the document
  contentSummary: string;           // AI-generated summary of what this section contains
  purpose: string;                  // AI-detected purpose of this section
  generatedPrompt: string;          // AI prompt to regenerate similar content
  suggestedTokenBudget: number;
  suggestedDensity: number;
  children: ImportedSection[];
}

export interface DocumentAnalysis {
  // Document identification
  detectedType: TemplateCategory;
  detectedDomain: DocumentTemplate["domain"];
  suggestedName: string;
  suggestedDescription: string;

  // Audience and purpose
  inferredAudience: string;
  inferredPurpose: string;
  keyThemes: string[];

  // Structure analysis
  totalSections: number;
  maxDepth: number;
  structure: ImportedSection[];

  // Template metadata suggestions
  suggestedIcon: string;
  suggestedColor: string;
  suggestedTags: string[];
  estimatedTime: string;

  // Quality metrics
  structureQuality: "well-organized" | "moderate" | "needs-improvement";
  contentCompleteness: number;  // 0-100

  // Raw analysis
  analysisNotes: string;
}

export interface ImportProgress {
  stage: "parsing" | "analyzing-structure" | "extracting-sections" | "generating-prompts" | "finalizing" | "complete" | "error";
  progress: number;  // 0-100
  currentSection?: string;
  message: string;
}

// ============================================================================
// Document Parsing Utilities
// ============================================================================

/**
 * Parse raw text to identify potential section headers and content blocks
 */
export function parseDocumentStructure(text: string): { headers: string[]; blocks: { header: string; content: string; level: number }[] } {
  const lines = text.split("\n");
  const blocks: { header: string; content: string; level: number }[] = [];
  const headers: string[] = [];

  let currentBlock: { header: string; content: string[]; level: number } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect markdown headers
    const mdMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      if (currentBlock) {
        blocks.push({ ...currentBlock, content: currentBlock.content.join("\n") });
      }
      const level = mdMatch[1].length - 1;
      const header = mdMatch[2];
      headers.push(header);
      currentBlock = { header, content: [], level };
      continue;
    }

    // Detect numbered section headers (1.0, 1.1, 2.3.4, etc.)
    const numberedMatch = trimmed.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    if (numberedMatch && !trimmed.includes(".") || (numberedMatch && trimmed.length < 100)) {
      if (currentBlock) {
        blocks.push({ ...currentBlock, content: currentBlock.content.join("\n") });
      }
      const level = (numberedMatch[1].match(/\./g) || []).length;
      const header = numberedMatch[2];
      headers.push(header);
      currentBlock = { header, content: [], level };
      continue;
    }

    // Detect ALL CAPS headers (common in formal documents)
    if (trimmed.length > 3 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      if (currentBlock) {
        blocks.push({ ...currentBlock, content: currentBlock.content.join("\n") });
      }
      headers.push(trimmed);
      currentBlock = { header: trimmed, content: [], level: 0 };
      continue;
    }

    // Detect underlined headers (text followed by === or ---)
    if (currentBlock && currentBlock.content.length === 0 && (trimmed.match(/^=+$/) || trimmed.match(/^-+$/))) {
      // Previous line was a header
      continue;
    }

    // Add content to current block
    if (currentBlock && trimmed) {
      currentBlock.content.push(trimmed);
    } else if (!currentBlock && trimmed) {
      // Content before any header - create intro block
      currentBlock = { header: "Introduction", content: [trimmed], level: 0 };
    }
  }

  // Don't forget the last block
  if (currentBlock) {
    blocks.push({ ...currentBlock, content: currentBlock.content.join("\n") });
  }

  return { headers, blocks };
}

/**
 * Estimate token budget based on content length and complexity
 */
export function estimateTokenBudget(content: string): number {
  const wordCount = content.split(/\s+/).length;
  const hasCode = /```|`[^`]+`/.test(content);
  const hasTables = /\|.*\|/.test(content);
  const hasLists = /^[-*]\s/m.test(content);

  let budget = Math.max(200, Math.min(2000, wordCount * 1.5));

  if (hasCode) budget *= 1.3;
  if (hasTables) budget *= 1.2;
  if (hasLists) budget *= 1.1;

  return Math.round(budget);
}

/**
 * Estimate content density target
 */
export function estimateDensity(content: string): number {
  const wordCount = content.split(/\s+/).length;
  const sentenceCount = (content.match(/[.!?]+/g) || []).length || 1;
  const avgSentenceLength = wordCount / sentenceCount;

  // Higher avg sentence length = more complex = higher density target
  if (avgSentenceLength > 25) return 0.85;
  if (avgSentenceLength > 20) return 0.75;
  if (avgSentenceLength > 15) return 0.65;
  return 0.5;
}

// ============================================================================
// AI Analysis Prompts
// ============================================================================

export const ANALYSIS_PROMPTS = {
  documentType: `Analyze this document and determine its type and domain.

DOCUMENT:
{{content}}

Respond with JSON:
{
  "detectedType": "government|commercial|technical|compliance|grants|legal|general",
  "detectedDomain": "government-proposal|commercial-proposal|technical-spec|compliance-doc|generic",
  "suggestedName": "Template name (generalized, not specific to this document)",
  "suggestedDescription": "2-3 sentence description of what this template is for",
  "inferredAudience": "Who would read/use this type of document",
  "inferredPurpose": "The primary goal of this document type",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "estimatedTime": "X-Y hours to complete",
  "structureQuality": "well-organized|moderate|needs-improvement",
  "analysisNotes": "Brief notes about the document structure and content"
}`,

  sectionPurpose: `Analyze this document section and determine its purpose and how to regenerate similar content.

SECTION TITLE: {{title}}
SECTION CONTENT:
{{content}}

DOCUMENT CONTEXT: {{context}}

Respond with JSON:
{
  "contentSummary": "1-2 sentence summary of what this section contains",
  "purpose": "Why this section exists and what it accomplishes",
  "generatedPrompt": "A detailed AI prompt that could be used to generate similar content for a new document. The prompt should be generalized (use {{placeholders}} for specific details) and focus on the structure, tone, and key elements to include.",
  "suggestedTokenBudget": 500,
  "suggestedDensity": 0.7
}`,

  generalizeTemplate: `You are creating a reusable document template from an existing document.

DOCUMENT STRUCTURE:
{{structure}}

DOCUMENT TYPE: {{type}}
AUDIENCE: {{audience}}
PURPOSE: {{purpose}}

For each section, provide a generalized AI prompt that could generate similar content for ANY document of this type (not just this specific document).

The prompts should:
1. Use {{placeholders}} for specific details (company name, project name, dates, etc.)
2. Focus on the TYPE of content needed, not the specific content
3. Include guidance on tone, length, and key elements to include
4. Reference what typically belongs in this section for this document type

Respond with a JSON array matching the input structure, with enhanced "generatedPrompt" fields.`
};

// ============================================================================
// AI Integration Functions
// ============================================================================

interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

async function callAICompletion(prompt: string, options: AICompletionOptions = {}): Promise<string> {
  const response = await fetch("/api/v1/ai/completion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI completion failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content || data.text || "";
}

function parseJSONResponse<T>(response: string): T {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }
  return JSON.parse(jsonMatch[0]);
}

// ============================================================================
// Main Import Functions
// ============================================================================

/**
 * Analyze a document and extract its structure with AI assistance
 */
export async function analyzeDocument(
  content: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<DocumentAnalysis> {
  const reportProgress = (stage: ImportProgress["stage"], progress: number, message: string, currentSection?: string) => {
    onProgress?.({ stage, progress, message, currentSection });
  };

  try {
    // Stage 1: Parse document structure
    reportProgress("parsing", 10, "Parsing document structure...");
    const { blocks } = parseDocumentStructure(content);

    if (blocks.length === 0) {
      throw new Error("Could not detect any document structure. Please ensure the document has clear section headers.");
    }

    // Stage 2: Analyze document type and metadata
    reportProgress("analyzing-structure", 20, "Analyzing document type and purpose...");
    const truncatedContent = content.length > 8000 ? content.slice(0, 8000) + "\n...[truncated]" : content;
    const typePrompt = ANALYSIS_PROMPTS.documentType.replace("{{content}}", truncatedContent);
    const typeResponse = await callAICompletion(typePrompt, { maxTokens: 1500 });
    const typeAnalysis = parseJSONResponse<{
      detectedType: TemplateCategory;
      detectedDomain: DocumentTemplate["domain"];
      suggestedName: string;
      suggestedDescription: string;
      inferredAudience: string;
      inferredPurpose: string;
      keyThemes: string[];
      suggestedTags: string[];
      estimatedTime: string;
      structureQuality: "well-organized" | "moderate" | "needs-improvement";
      analysisNotes: string;
    }>(typeResponse);

    // Stage 3: Analyze each section
    reportProgress("extracting-sections", 30, "Extracting section content...");
    const sections: ImportedSection[] = [];
    const totalBlocks = blocks.length;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const progressPercent = 30 + Math.floor((i / totalBlocks) * 40);
      reportProgress("generating-prompts", progressPercent, `Analyzing section ${i + 1} of ${totalBlocks}...`, block.header);

      const sectionPrompt = ANALYSIS_PROMPTS.sectionPurpose
        .replace("{{title}}", block.header)
        .replace("{{content}}", block.content.slice(0, 3000))
        .replace("{{context}}", `Document type: ${typeAnalysis.detectedType}, Purpose: ${typeAnalysis.inferredPurpose}`);

      try {
        const sectionResponse = await callAICompletion(sectionPrompt, { maxTokens: 1000 });
        const sectionAnalysis = parseJSONResponse<{
          contentSummary: string;
          purpose: string;
          generatedPrompt: string;
          suggestedTokenBudget: number;
          suggestedDensity: number;
        }>(sectionResponse);

        sections.push({
          level: block.level,
          title: block.header,
          originalContent: block.content,
          contentSummary: sectionAnalysis.contentSummary,
          purpose: sectionAnalysis.purpose,
          generatedPrompt: sectionAnalysis.generatedPrompt,
          suggestedTokenBudget: sectionAnalysis.suggestedTokenBudget || estimateTokenBudget(block.content),
          suggestedDensity: sectionAnalysis.suggestedDensity || estimateDensity(block.content),
          children: [],
        });
      } catch (error) {
        // Fallback for section analysis failure
        sections.push({
          level: block.level,
          title: block.header,
          originalContent: block.content,
          contentSummary: `Content for ${block.header}`,
          purpose: `Provides ${block.header.toLowerCase()} information`,
          generatedPrompt: `Write a ${block.header.toLowerCase()} section that covers the key points relevant to {{document_topic}}. Focus on clarity and completeness.`,
          suggestedTokenBudget: estimateTokenBudget(block.content),
          suggestedDensity: estimateDensity(block.content),
          children: [],
        });
      }
    }

    // Stage 4: Build hierarchical structure
    reportProgress("finalizing", 80, "Building template structure...");
    const hierarchicalSections = buildHierarchy(sections);

    // Stage 5: Calculate metrics and finalize
    reportProgress("finalizing", 90, "Calculating metrics...");
    const maxDepth = Math.max(...sections.map(s => s.level)) + 1;
    const contentCompleteness = Math.min(100, Math.round((sections.filter(s => s.originalContent.length > 50).length / sections.length) * 100));

    // Determine icon and color based on type
    const iconMap: Record<TemplateCategory, string> = {
      government: "Landmark",
      commercial: "Briefcase",
      technical: "Cpu",
      compliance: "Shield",
      grants: "GraduationCap",
      legal: "Scale",
      general: "FileText",
    };

    const colorMap: Record<TemplateCategory, string> = {
      government: "#dc2626",
      commercial: "#2563eb",
      technical: "#7c3aed",
      compliance: "#059669",
      grants: "#d97706",
      legal: "#4f46e5",
      general: "#64748b",
    };

    reportProgress("complete", 100, "Analysis complete!");

    return {
      detectedType: typeAnalysis.detectedType,
      detectedDomain: typeAnalysis.detectedDomain,
      suggestedName: typeAnalysis.suggestedName,
      suggestedDescription: typeAnalysis.suggestedDescription,
      inferredAudience: typeAnalysis.inferredAudience,
      inferredPurpose: typeAnalysis.inferredPurpose,
      keyThemes: typeAnalysis.keyThemes,
      totalSections: sections.length,
      maxDepth,
      structure: hierarchicalSections,
      suggestedIcon: iconMap[typeAnalysis.detectedType] || "FileText",
      suggestedColor: colorMap[typeAnalysis.detectedType] || "#64748b",
      suggestedTags: typeAnalysis.suggestedTags,
      estimatedTime: typeAnalysis.estimatedTime,
      structureQuality: typeAnalysis.structureQuality,
      contentCompleteness,
      analysisNotes: typeAnalysis.analysisNotes,
    };
  } catch (error) {
    reportProgress("error", 0, `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    throw error;
  }
}

/**
 * Build hierarchical structure from flat section list
 */
function buildHierarchy(sections: ImportedSection[]): ImportedSection[] {
  const root: ImportedSection[] = [];
  const stack: { section: ImportedSection; level: number }[] = [];

  for (const section of sections) {
    const newSection = { ...section, children: [] };

    // Pop stack until we find a parent
    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(newSection);
    } else {
      stack[stack.length - 1].section.children.push(newSection);
    }

    stack.push({ section: newSection, level: section.level });
  }

  return root;
}

/**
 * Convert analyzed document to a DocumentTemplate
 */
export function createTemplateFromAnalysis(
  analysis: DocumentAnalysis,
  customizations?: {
    name?: string;
    description?: string;
    purpose?: string;
    targetAudience?: string;
    usageAdvice?: string;
    bestPractices?: string[];
  }
): DocumentTemplate {
  const convertToTemplateNode = (section: ImportedSection): TemplateNode => {
    const type: TemplateNode["type"] =
      section.level === 0 ? "chapter" :
      section.level === 1 ? "section" :
      section.level === 2 ? "subsection" :
      "paragraph";

    return {
      type,
      title: section.title,
      description: section.purpose,
      aiPrompt: section.generatedPrompt,
      tokenBudget: section.suggestedTokenBudget,
      densityTarget: section.suggestedDensity,
      children: section.children.map(convertToTemplateNode),
    };
  };

  const templateId = `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: templateId,
    name: customizations?.name || analysis.suggestedName,
    description: customizations?.description || analysis.suggestedDescription,
    category: analysis.detectedType,
    domain: analysis.detectedDomain,
    structure: analysis.structure.map(convertToTemplateNode),

    icon: analysis.suggestedIcon,
    color: analysis.suggestedColor,
    estimatedNodes: analysis.totalSections,
    estimatedTime: analysis.estimatedTime,

    defaultType: analysis.detectedDomain === "government-proposal" ? "proposal" :
                 analysis.detectedDomain === "commercial-proposal" ? "proposal" :
                 analysis.detectedDomain === "technical-spec" ? "technical" :
                 analysis.detectedDomain === "compliance-doc" ? "compliance" :
                 "whitepaper",
    defaultObjectives: analysis.keyThemes.slice(0, 3),
    suggestedTags: analysis.suggestedTags,

    aiPromptHint: `Generate a ${analysis.suggestedName.toLowerCase()} for {{topic}} targeting {{audience}}. Key themes: ${analysis.keyThemes.join(", ")}.`,

    purpose: customizations?.purpose || analysis.inferredPurpose,
    targetAudience: customizations?.targetAudience || analysis.inferredAudience,
    usageAdvice: customizations?.usageAdvice || `Use this template when creating ${analysis.detectedType} documents. Best suited for ${analysis.inferredAudience}.`,
    bestPractices: customizations?.bestPractices || [
      `Focus on ${analysis.keyThemes[0] || "clarity and completeness"}`,
      `Tailor content for ${analysis.inferredAudience}`,
      `Maintain consistent tone throughout`,
    ],

    isCustom: true,
    isNew: true,
    lastModified: new Date(),
  };
}

/**
 * Validate imported template structure
 */
export function validateTemplate(template: DocumentTemplate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.name || template.name.length < 3) {
    errors.push("Template name must be at least 3 characters");
  }

  if (!template.description || template.description.length < 10) {
    errors.push("Template description must be at least 10 characters");
  }

  if (!template.structure || template.structure.length === 0) {
    errors.push("Template must have at least one section");
  }

  const validateNode = (node: TemplateNode, path: string) => {
    if (!node.title || node.title.length < 2) {
      errors.push(`Section at ${path} must have a title`);
    }
    if (node.children) {
      node.children.forEach((child, i) => validateNode(child, `${path}/${i}`));
    }
  };

  template.structure.forEach((node, i) => validateNode(node, `${i}`));

  return { valid: errors.length === 0, errors };
}
