"use client";

/**
 * AI Client for HDSI - Real API Integration
 *
 * Connects to the DocFusion AI API for content generation.
 */

import { logger } from "@/lib/utils/logger";
import type { HDSINode } from "./types";

export interface GenerateContentOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onProgress?: (chunk: string) => void;
  /** Full document structure for context */
  documentStructure?: HDSINode[];
  /** Sibling sections' titles for coherence */
  siblingTitles?: string[];
  /** Parent section title for hierarchy context */
  parentTitle?: string;
  /** Previous section with title and optional content summary */
  previousSection?: { title: string; content?: string };
  /** Next section title (for transition awareness) */
  nextSection?: { title: string };
  /** Already-written sibling sections with content */
  siblingContents?: Array<{ title: string; content?: string }>;
}

/**
 * Structured outline section returned from AI
 */
export interface OutlineSection {
  title: string;
  type: "chapter" | "section" | "subsection";
  description: string;
  customPrompt: string;
  suggestedTokenBudget: number;
  children?: OutlineSection[];
}

/**
 * Generate content for a document section using the AI API
 */
export async function generateSectionContent(
  node: HDSINode,
  documentTitle: string,
  options: GenerateContentOptions = {}
): Promise<string> {
  const {
    temperature = 0.7,
    maxTokens = 2000,
    stream = false,
    onProgress,
    documentStructure = [],
    siblingTitles = [],
    parentTitle,
    previousSection,
    nextSection,
    siblingContents = [],
  } = options;

  // Build document outline context
  const buildOutlineContext = (nodes: HDSINode[], depth = 0): string => {
    return nodes.map(n => {
      const indent = "  ".repeat(depth);
      const mark = n.id === node.id ? " ← (CURRENT SECTION)" : "";
      const status = n.generatedContent ? " [written]" : "";
      let line = `${indent}- ${n.title}${status}${mark}`;
      if (n.children && n.children.length > 0) {
        line += "\n" + buildOutlineContext(n.children, depth + 1);
      }
      return line;
    }).join("\n");
  };

  // Get context from previously generated sibling sections
  const getSiblingContext = (): string => {
    if (siblingTitles.length === 0) return "";
    return `\nSibling Sections: ${siblingTitles.join(", ")}`;
  };

  // Build context from previous section (for continuity)
  const getPreviousSectionContext = (): string => {
    if (!previousSection) return "";
    let context = `\n\n## PREVIOUS SECTION CONTEXT (Write as a continuation of this):\nPrevious Section Title: "${previousSection.title}"`;
    if (previousSection.content) {
      context += `\nPrevious Section Summary:\n${previousSection.content}`;
    }
    return context;
  };

  // Build context about what comes next (for transitions)
  const getNextSectionContext = (): string => {
    if (!nextSection) return "";
    return `\n\n## NEXT SECTION PREVIEW:\nThe next section is titled "${nextSection.title}" - end this section with a smooth transition leading into that topic.`;
  };

  // Build context from already-written siblings (for coherence)
  const getWrittenSiblingsContext = (): string => {
    if (siblingContents.length === 0) return "";
    const summaries = siblingContents.slice(0, 3).map(s =>
      `- "${s.title}": ${s.content || "(content pending)"}`
    ).join("\n");
    return `\n\n## ALREADY WRITTEN SIBLING SECTIONS (Maintain consistency, avoid repetition):\n${summaries}`;
  };

  // Build the prompt with full document context
  const documentOutline = documentStructure.length > 0
    ? `\nDocument Outline:\n${buildOutlineContext(documentStructure)}`
    : "";

  const hierarchyContext = parentTitle
    ? `\nParent Section: ${parentTitle}`
    : "";

  const systemPrompt = `You are a professional document writing assistant. Write high-quality, detailed content for a document section.

## SECTION METADATA:
Document Title: ${documentTitle}
Section Type: ${node.type}
Section Title: ${node.title}
Token Budget: Approximately ${node.tokenBudget} tokens
Density Target: ${node.densityTarget}/5 (information density)${hierarchyContext}${getSiblingContext()}${documentOutline}${getPreviousSectionContext()}${getWrittenSiblingsContext()}${getNextSectionContext()}

## GUIDELINES:
- Write comprehensive, well-structured content that CONTINUES from the previous section
- If there's a previous section, begin with a brief transition (1 sentence) that connects ideas
- Use professional language appropriate for the document type
- Include relevant details, examples, and analysis
- Maintain consistency with document tone and already written sections
- DO NOT repeat information already covered in sibling sections
- Write in paragraphs, not bullet points unless appropriate
- Ensure logical flow and coherent narrative
- If there's a next section mentioned, end with a natural transition toward that topic
${node.customPrompt ? `\n## CUSTOM INSTRUCTIONS:\n${node.customPrompt}` : ""}`;

  try {
    if (stream && onProgress) {
      // Streaming generation
      const response = await fetch("/api/v1/ai/completion/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Write the content for the "${node.title}" section.` }
          ],
          temperature,
          maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      let content = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content || "";
              content += text;
              onProgress(content);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      return content;
    } else {
      // Non-streaming generation
      const response = await fetch("/api/v1/ai/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Write the content for the "${node.title}" section.` }
          ],
          temperature,
          maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }

      const data = await response.json();
      return data.content || "No content generated";
    }
  } catch (error) {
    logger.error("AI Generation error:", error);

    // Fallback to mock if API is not available
    if (error instanceof Error && error.message.includes("No AI provider available")) {
      logger.debug("AI provider not available, using fallback");
      return generateFallbackContent(node);
    }

    throw error;
  }
}

// ============================================================================
// Structure Validation Constants
// ============================================================================

const MIN_SECTIONS_PER_CHAPTER = 3;
const MIN_SUBSECTIONS_PER_SECTION = 2;

/**
 * Generate a deep, context-aware outline from description using AI
 */
export async function generateOutlineFromDescription(
  title: string,
  description: string
): Promise<OutlineSection[]> {
  const systemPrompt = `You are an expert document architect and structural strategist. Transform the provided context into a comprehensive, logically sequenced, and audience-optimized document blueprint.

## CORE PRINCIPLES:

1. **Storytelling Logic**: Structure as a narrative journey moving audience from current state to desired outcome, overcoming objections along the way.
2. **Progressive Disclosure**: Start with high-impact essential information, layer detail progressively for both skimmers and deep readers.
3. **Persuasive Pathway**: Every structural element serves the primary goal. Each chapter builds upon the last.
4. **Modular Completeness**: Each node (Chapter > Section > Subsection) is self-contained with a clear "job to do".

## STRUCTURAL MANDATES (Non-Negotiable):

- **Document**: 3-6 Chapters
- **Each Chapter**: ${MIN_SECTIONS_PER_CHAPTER}-5 Sections minimum
- **Each Section**: ${MIN_SUBSECTIONS_PER_SECTION}-4 Subsections minimum
- **Each Subsection**: Single focused concept, data point, or argumentative step

## NARRATIVE ARC MAPPING:

Plot the journey based on the description:
- **Hook & Problem Recognition** (Early Chapters) - Engage and establish stakes
- **Solution Foundation & Vision** (Middle Chapters) - Present approach and methodology
- **Proof & Validation** (Bridge Chapters) - Provide evidence and address objections
- **Action & Resolution** (Final Chapters) - Guide to decision/implementation

## NODE REQUIREMENTS:

For EVERY node you MUST generate:
1. **title**: Clear, benefit-oriented or action-focused headline
2. **type**: "chapter", "section", or "subsection"
3. **description**: Strategic objective - why this node exists (its role in the journey)
4. **customPrompt**: Detailed, self-contained instruction that:
   - States the audience context from the description
   - References relevant themes and credibility elements
   - Specifies content type (comparative table, case study, procedure, data analysis, FAQ, etc.)
   - Defines tone and style cues
   - Sets formatting guidelines (bold takeaways, bullet points, transitions)
   - Is truly standalone - another writer could execute it without additional context
5. **suggestedTokenBudget**: Appropriate length based on importance (300-800)

## OUTPUT FORMAT (JSON Array):

Return ONLY valid JSON:
[
  {
    "title": "Chapter Title",
    "type": "chapter",
    "description": "Strategic role: why this chapter exists in the narrative arc",
    "customPrompt": "Comprehensive instruction incorporating audience context, themes, tone, content type, and formatting. Must be self-contained.",
    "suggestedTokenBudget": 500,
    "children": [
      {
        "title": "Section Title",
        "type": "section",
        "description": "Section role: Problem Definition | Solution Overview | Evidence | Procedure",
        "customPrompt": "Detailed instruction referencing specific audience questions and themes...",
        "suggestedTokenBudget": 400,
        "children": [
          {
            "title": "Subsection Title",
            "type": "subsection",
            "description": "Content type: Data Analysis | Case Study | Step | Comparison | FAQ",
            "customPrompt": "Atomic writing instruction answering single sub-question or presenting one unit of proof. Include tone and formatting notes.",
            "suggestedTokenBudget": 300,
            "children": []
          }
        ]
      }
    ]
  }
]

## DOMAIN-SPECIFIC STRUCTURE PATTERNS:

- **Government Proposals**: Compliance matrix, technical approach, past performance, management plan, cost/price
- **Technical Specifications**: Requirements, architecture, interfaces, testing, maintenance
- **Business Plans**: Executive summary, market analysis, competitive landscape, financials, risk assessment
- **Research Papers**: Abstract, methodology, results, discussion, conclusions
- **White Papers**: Problem statement, solution framework, evidence, implementation, call-to-action

## QUALITY CHECKLIST:

Ensure your structure:
- Directly maps to every key theme and critical question in the description
- Preemptively addresses anticipated objections in logical places
- Sequences information for maximum impact (conclusions early, details later)
- Varies content types (narrative, data, process, example) to maintain engagement
- Provides clear pathways for both executive skimmers (via titles) and detailed readers
- Every customPrompt is truly standalone with all necessary context and directives`;

  const userPrompt = `Transform this strategic analysis into a persuasive document architecture:

DOCUMENT TITLE: ${title}

STRATEGIC CONTEXT & DISCOVERY ANALYSIS:
${description}

ARCHITECTURE REQUIREMENTS:
- Generate 3-6 CHAPTERS following the narrative arc (Hook → Solution → Proof → Action)
- Each chapter MUST have ${MIN_SECTIONS_PER_CHAPTER}-5 SECTIONS
- Each section MUST have ${MIN_SUBSECTIONS_PER_SECTION}-4 SUBSECTIONS
- Every node needs a strategic objective explaining its role in the persuasive journey
- Every customPrompt must be self-contained with audience context, content type, tone, and formatting directives
- Vary content types: narrative, data analysis, case studies, procedures, comparisons, FAQs
- Address the critical questions and anticipated objections from the analysis
- Incorporate the credibility elements and evidence types specified

Return ONLY the JSON array of chapters.`;

  try {
    const response = await fetch("/api/v1/ai/completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        maxTokens: 3000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Outline generation failed");
    }

    const data = await response.json();
    const content = data.content || "[]";

    // Parse JSON from the response with robust cleanup
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      // Clean up common JSON issues from AI responses
      let jsonStr = jsonMatch[0]
        // Remove trailing commas before ] or }
        .replace(/,(\s*[\]\}])/g, "$1")
        // Remove any control characters
        .replace(/[\x00-\x1F\x7F]/g, " ")
        // Fix unescaped newlines in strings
        .replace(/([^\\])\\n(?=[^"])/g, "$1\\\\n")
        // Remove comments (AI sometimes adds them)
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

      try {
        const parsed = JSON.parse(jsonStr);
        // Validate, ensure required fields, and enforce structure rules
        const normalizedSections = parsed.map((section: Record<string, unknown>) => normalizeSection(section, title, description));
        return enforceStructuralRules(normalizedSections, title, description);
      } catch (parseError) {
        logger.error("JSON parse error after cleanup:", parseError);
        logger.error("Attempted to parse:", jsonStr.substring(0, 500));
        // Fall through to fallback
      }
    }

    logger.warn("Could not parse AI response, using smart fallback");
    return generateSmartFallbackOutline(title, description);
  } catch (error) {
    logger.error("Outline generation error:", error);

    // Enhanced fallback that uses the description to generate better sections
    return generateSmartFallbackOutline(title, description);
  }
}

/**
 * Normalize a section from AI response
 */
function normalizeSection(section: Record<string, unknown>, docTitle: string, docDescription: string): OutlineSection {
  const title = (section.title as string) || "Untitled Section";
  return {
    title,
    type: (section.type as OutlineSection["type"]) || "section",
    description: (section.description as string) || "",
    customPrompt: (section.customPrompt as string) || `Write comprehensive content for the "${title}" section in the context of "${docTitle}". Reference: ${docDescription.slice(0, 100)}.`,
    suggestedTokenBudget: (section.suggestedTokenBudget as number) || 500,
    children: ((section.children as Record<string, unknown>[]) || []).map((child) => normalizeSection(child, docTitle, docDescription)),
  };
}

/**
 * Enforce structural rules: min sections per chapter, min subsections per section
 */
function enforceStructuralRules(sections: OutlineSection[], docTitle: string, docDescription: string): OutlineSection[] {
  return sections.map(section => {
    if (section.type === "chapter") {
      // Ensure chapter has minimum sections
      const children = section.children || [];
      while (children.length < MIN_SECTIONS_PER_CHAPTER) {
        const sectionNum = children.length + 1;
        children.push(createFillerSection(section.title, sectionNum, docTitle, docDescription));
      }
      // Recursively enforce rules on children (pass chapter title for context)
      const chapterTitle = section.title;
      section.children = children.map(child => {
        if (child.type === "section") {
          return enforceSubsectionRules(child, chapterTitle, docTitle, docDescription);
        }
        return child;
      });
    } else if (section.type === "section") {
      // For standalone sections, use section title as context
      section = enforceSubsectionRules(section, section.title, docTitle, docDescription);
    }
    return section;
  });
}

/**
 * Ensure a section has minimum subsections
 */
function enforceSubsectionRules(
  section: OutlineSection,
  chapterTitle: string,
  docTitle: string,
  docDescription: string
): OutlineSection {
  const children = section.children || [];
  while (children.length < MIN_SUBSECTIONS_PER_SECTION) {
    const subNum = children.length + 1;
    children.push(createFillerSubsection(chapterTitle, section.title, subNum, docTitle, docDescription));
  }
  section.children = children;
  return section;
}

/**
 * Create a filler section when chapter doesn't have enough
 */
function createFillerSection(chapterTitle: string, num: number, docTitle: string, docDescription: string): OutlineSection {
  // Generate context-aware section titles based on chapter theme
  const sectionTemplates = generateContextualSectionTitles(chapterTitle, docDescription);
  const title = sectionTemplates[num - 1] || `${chapterTitle} - Aspect ${num}`;

  return {
    title,
    type: "section",
    description: `Supporting content for ${chapterTitle}`,
    customPrompt: `Provide detailed supporting content for "${chapterTitle}" focusing on "${title}". Context: ${docDescription.slice(0, 150)}. Ensure this complements the main chapter content with specific, actionable information.`,
    suggestedTokenBudget: 400,
    children: [
      createFillerSubsection(chapterTitle, title, 1, docTitle, docDescription),
      createFillerSubsection(chapterTitle, title, 2, docTitle, docDescription),
    ],
  };
}

/**
 * Generate context-aware section titles based on chapter theme
 */
function generateContextualSectionTitles(chapterTitle: string, docDescription: string): string[] {
  const lowerChapter = chapterTitle.toLowerCase();
  const lowerDesc = docDescription.toLowerCase();

  // Technical chapters
  if (/architecture|system|design|technical/i.test(lowerChapter)) {
    return [
      `${chapterTitle} Components`,
      `${chapterTitle} Integration Points`,
      `${chapterTitle} Performance Considerations`,
      `${chapterTitle} Security Aspects`,
      `${chapterTitle} Scalability Factors`,
    ];
  }

  // Management chapters
  if (/management|approach|plan|governance/i.test(lowerChapter)) {
    return [
      `${chapterTitle} Framework`,
      `${chapterTitle} Team Structure`,
      `${chapterTitle} Risk Mitigation`,
      `${chapterTitle} Quality Controls`,
      `${chapterTitle} Communication Protocols`,
    ];
  }

  // Requirements chapters
  if (/requirement|specification|scope/i.test(lowerChapter)) {
    return [
      `${chapterTitle} Categories`,
      `${chapterTitle} Priorities`,
      `${chapterTitle} Dependencies`,
      `${chapterTitle} Acceptance Criteria`,
      `${chapterTitle} Constraints`,
    ];
  }

  // Analysis chapters
  if (/analysis|assessment|evaluation|review/i.test(lowerChapter)) {
    return [
      `${chapterTitle} Methodology`,
      `${chapterTitle} Data Sources`,
      `${chapterTitle} Findings Summary`,
      `${chapterTitle} Comparative Assessment`,
      `${chapterTitle} Gap Identification`,
    ];
  }

  // Implementation chapters
  if (/implementation|execution|deployment|rollout/i.test(lowerChapter)) {
    return [
      `${chapterTitle} Phases`,
      `${chapterTitle} Resources`,
      `${chapterTitle} Timeline`,
      `${chapterTitle} Milestones`,
      `${chapterTitle} Success Criteria`,
    ];
  }

  // Financial chapters
  if (/cost|price|budget|financial|investment/i.test(lowerChapter)) {
    return [
      `${chapterTitle} Breakdown`,
      `${chapterTitle} Assumptions`,
      `${chapterTitle} ROI Analysis`,
      `${chapterTitle} Risk Factors`,
      `${chapterTitle} Payment Terms`,
    ];
  }

  // Default context-aware titles
  return [
    `${chapterTitle} Foundation`,
    `${chapterTitle} Core Elements`,
    `${chapterTitle} Strategic Considerations`,
    `${chapterTitle} Practical Applications`,
    `${chapterTitle} Success Factors`,
  ];
}

/**
 * Create a filler subsection when section doesn't have enough
 * Now generates contextual names based on chapter and section context
 */
function createFillerSubsection(
  chapterTitle: string,
  sectionTitle: string,
  num: number,
  docTitle: string,
  docDescription: string
): OutlineSection {
  // Generate context-aware subsection titles
  const subtitles = generateContextualSubsectionTitles(chapterTitle, sectionTitle, docDescription);
  const subtitle = subtitles[num - 1] || `${sectionTitle} Detail ${num}`;

  return {
    title: subtitle,
    type: "subsection",
    description: `Detailed aspect of ${sectionTitle} within ${chapterTitle}`,
    customPrompt: `Write focused content about "${subtitle}" as it relates to "${sectionTitle}" in the context of "${chapterTitle}" for "${docTitle}". Be specific, detailed, and actionable. Include concrete examples and data points where applicable. Reference: ${docDescription.slice(0, 100)}.`,
    suggestedTokenBudget: 300,
    children: [],
  };
}

/**
 * Generate context-aware subsection titles based on section and chapter themes
 */
function generateContextualSubsectionTitles(chapterTitle: string, sectionTitle: string, docDescription: string): string[] {
  const lowerSection = sectionTitle.toLowerCase();
  const lowerChapter = chapterTitle.toLowerCase();

  // Extract a clean topic from section title (remove chapter prefix if present)
  const sectionTopic = sectionTitle.replace(new RegExp(`^${chapterTitle}\\s*[-–—]?\\s*`, "i"), "").trim() || sectionTitle;

  // Components/Architecture subsections
  if (/component|module|architecture|system/i.test(lowerSection)) {
    return [
      `${sectionTopic} Specifications`,
      `${sectionTopic} Interfaces`,
      `${sectionTopic} Data Flow`,
      `${sectionTopic} Configuration`,
      `${sectionTopic} Validation`,
    ];
  }

  // Framework/Methodology subsections
  if (/framework|methodology|approach|process/i.test(lowerSection)) {
    return [
      `${sectionTopic} Foundation`,
      `${sectionTopic} Key Steps`,
      `${sectionTopic} Tools & Techniques`,
      `${sectionTopic} Best Practices`,
      `${sectionTopic} Quality Measures`,
    ];
  }

  // Team/Resources subsections
  if (/team|resource|personnel|staff/i.test(lowerSection)) {
    return [
      `${sectionTopic} Roles & Responsibilities`,
      `${sectionTopic} Skills & Qualifications`,
      `${sectionTopic} Allocation Plan`,
      `${sectionTopic} Training Needs`,
      `${sectionTopic} Capacity Planning`,
    ];
  }

  // Risk/Mitigation subsections
  if (/risk|mitigation|contingency|issue/i.test(lowerSection)) {
    return [
      `${sectionTopic} Identification`,
      `${sectionTopic} Assessment`,
      `${sectionTopic} Response Strategies`,
      `${sectionTopic} Monitoring Plan`,
      `${sectionTopic} Escalation Procedures`,
    ];
  }

  // Timeline/Schedule subsections
  if (/timeline|schedule|phase|milestone/i.test(lowerSection)) {
    return [
      `${sectionTopic} Overview`,
      `${sectionTopic} Critical Path`,
      `${sectionTopic} Dependencies`,
      `${sectionTopic} Deliverables`,
      `${sectionTopic} Checkpoints`,
    ];
  }

  // Integration subsections
  if (/integration|interface|connection|api/i.test(lowerSection)) {
    return [
      `${sectionTopic} Requirements`,
      `${sectionTopic} Protocols`,
      `${sectionTopic} Data Mapping`,
      `${sectionTopic} Testing Approach`,
      `${sectionTopic} Error Handling`,
    ];
  }

  // Quality/Control subsections
  if (/quality|control|assurance|validation/i.test(lowerSection)) {
    return [
      `${sectionTopic} Standards`,
      `${sectionTopic} Metrics`,
      `${sectionTopic} Review Process`,
      `${sectionTopic} Acceptance Criteria`,
      `${sectionTopic} Continuous Improvement`,
    ];
  }

  // Default: Use varied, unique titles that avoid repetitive patterns
  // Pick different combinations based on section topic hash to ensure variety
  const topicHash = sectionTopic.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const variations = [
    [`${sectionTopic} Overview`, `${sectionTopic} Key Elements`, `${sectionTopic} Application`, `${sectionTopic} Considerations`],
    [`${sectionTopic} Context`, `${sectionTopic} Approach`, `${sectionTopic} Details`, `${sectionTopic} Outcomes`],
    [`${sectionTopic} Background`, `${sectionTopic} Methodology`, `${sectionTopic} Analysis`, `${sectionTopic} Recommendations`],
    [`${sectionTopic} Objectives`, `${sectionTopic} Scope`, `${sectionTopic} Execution`, `${sectionTopic} Results`],
    [`${sectionTopic} Introduction`, `${sectionTopic} Core Concepts`, `${sectionTopic} Practical Steps`, `${sectionTopic} Summary`],
  ];
  return variations[topicHash % variations.length];
}

/**
 * Smart fallback outline generator that analyzes the description
 */
function generateSmartFallbackOutline(title: string, description: string): OutlineSection[] {
  const lowerDesc = description.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Detect document type from title and description
  const isProposal = /proposal|rfp|rfq|bid|solicitation|contract/i.test(lowerDesc + lowerTitle);
  const isTechnical = /technical|specification|architecture|system|design|engineering/i.test(lowerDesc + lowerTitle);
  const isGovt = /government|federal|far|dfars|compliance|agency|gsa/i.test(lowerDesc + lowerTitle);
  const isBusiness = /business|plan|strategy|market|startup|venture/i.test(lowerDesc + lowerTitle);
  const isResearch = /research|study|analysis|findings|methodology|hypothesis/i.test(lowerDesc + lowerTitle);
  const isReport = /report|assessment|evaluation|review|audit/i.test(lowerDesc + lowerTitle);

  // Extract key topics from description
  const extractedTopics = extractKeyTopics(description);

  let outline: OutlineSection[];

  if (isGovt || isProposal) {
    outline = generateGovtProposalOutline(title, description, extractedTopics);
  } else if (isTechnical) {
    outline = generateTechnicalOutline(title, description, extractedTopics);
  } else if (isBusiness) {
    outline = generateBusinessOutline(title, description, extractedTopics);
  } else if (isResearch) {
    outline = generateResearchOutline(title, description, extractedTopics);
  } else if (isReport) {
    outline = generateReportOutline(title, description, extractedTopics);
  } else {
    outline = generateDefaultOutline(title, description, extractedTopics);
  }

  // Enforce structural rules on all fallback outlines
  return enforceStructuralRules(outline, title, description);
}

/**
 * Extract key topics and requirements from description
 */
function extractKeyTopics(description: string): string[] {
  const topics: string[] = [];

  // Look for numbered/bulleted items
  const listItems = description.match(/(?:^|\n)\s*(?:\d+\.|[-•*])\s*(.+)/gm);
  if (listItems) {
    topics.push(...listItems.map(item => item.replace(/^[\s\d.\-•*]+/, "").trim()));
  }

  // Look for key phrases
  const keyPhrases = description.match(/(?:include|cover|address|discuss|analyze|describe|explain|outline)\s+([^.!?\n]+)/gi);
  if (keyPhrases) {
    topics.push(...keyPhrases.map(phrase =>
      phrase.replace(/^(?:include|cover|address|discuss|analyze|describe|explain|outline)\s+/i, "").trim()
    ));
  }

  // Look for quoted items
  const quoted = description.match(/"([^"]+)"/g);
  if (quoted) {
    topics.push(...quoted.map(q => q.replace(/"/g, "")));
  }

  return [...new Set(topics)].slice(0, 10); // Dedupe and limit
}

/**
 * Government/Proposal outline generator
 */
function generateGovtProposalOutline(title: string, description: string, topics: string[]): OutlineSection[] {
  return [
    {
      title: "Executive Summary",
      type: "chapter",
      description: "High-level overview of the proposal",
      customPrompt: `Write a compelling executive summary for "${title}". Address the key requirements: ${description.slice(0, 200)}. Include: solution overview, key differentiators, compliance commitment, and value proposition. Write in active voice for government evaluators. Keep it concise but comprehensive.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Technical Approach",
      type: "chapter",
      description: "Detailed technical solution",
      customPrompt: `Detail the technical approach for "${title}". Based on requirements: ${topics.slice(0, 3).join(", ") || description.slice(0, 150)}. Include: methodology, tools/technologies, technical risks and mitigations, and innovation aspects. Use clear headings and demonstrate understanding of the technical challenges.`,
      suggestedTokenBudget: 1000,
      children: [
        {
          title: "Solution Architecture",
          type: "section",
          description: "System design and components",
          customPrompt: `Describe the solution architecture addressing: ${topics.slice(0, 2).join(", ") || "core technical requirements"}. Include diagrams references, component interactions, and scalability considerations.`,
          suggestedTokenBudget: 500,
          children: [],
        },
        {
          title: "Implementation Methodology",
          type: "section",
          description: "How the solution will be delivered",
          customPrompt: `Outline the implementation methodology including phases, milestones, and deliverables. Reference: ${description.slice(0, 100)}. Include risk mitigation strategies.`,
          suggestedTokenBudget: 400,
          children: [],
        },
      ],
    },
    {
      title: "Management Approach",
      type: "chapter",
      description: "Project management and governance",
      customPrompt: `Describe the management approach for "${title}". Include: organizational structure, key personnel roles, communication plan, quality assurance processes, and reporting mechanisms. Demonstrate capability to manage government contracts.`,
      suggestedTokenBudget: 700,
      children: [],
    },
    {
      title: "Past Performance",
      type: "chapter",
      description: "Relevant experience and references",
      customPrompt: `Present past performance relevant to "${title}". Include 2-3 similar projects with: scope, challenges overcome, results achieved, and client references. Emphasize government contract experience if applicable.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Compliance Matrix",
      type: "chapter",
      description: "Requirements compliance tracking",
      customPrompt: `Create a compliance matrix addressing all requirements from: ${description.slice(0, 200)}. Format as a table with: requirement reference, compliance status (Compliant/Partial/Alternative), and proposal section reference. Ensure 100% traceability.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Staffing Plan",
      type: "section",
      description: "Team composition and qualifications",
      customPrompt: `Detail the staffing plan including: key personnel, qualifications, roles and responsibilities, and team organization chart. Address any specific personnel requirements from: ${topics.join(", ") || "the solicitation"}.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Cost/Price Proposal",
      type: "chapter",
      description: "Pricing and cost breakdown",
      customPrompt: `Present the cost proposal structure including: pricing methodology, labor categories, rate justification, and value analysis. Note: Include placeholder tables for actual pricing. Demonstrate cost realism and competitiveness.`,
      suggestedTokenBudget: 400,
      children: [],
    },
  ];
}

/**
 * Technical documentation outline generator
 */
function generateTechnicalOutline(title: string, description: string, topics: string[]): OutlineSection[] {
  return [
    {
      title: "Introduction",
      type: "chapter",
      description: "Document purpose and scope",
      customPrompt: `Write the introduction for "${title}". Cover: document purpose, intended audience, scope boundaries, and document organization. Reference key technical areas: ${topics.slice(0, 3).join(", ") || description.slice(0, 100)}.`,
      suggestedTokenBudget: 400,
      children: [],
    },
    {
      title: "System Overview",
      type: "chapter",
      description: "High-level system description",
      customPrompt: `Provide a system overview for "${title}". Include: system context, major components, external interfaces, and key design decisions. Address: ${description.slice(0, 150)}.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Requirements",
      type: "chapter",
      description: "Functional and non-functional requirements",
      customPrompt: `Document requirements including functional requirements, non-functional requirements (performance, security, scalability), and constraints. Base on: ${topics.join(", ") || description.slice(0, 200)}. Use clear requirement IDs and testable criteria.`,
      suggestedTokenBudget: 800,
      children: [
        {
          title: "Functional Requirements",
          type: "section",
          description: "What the system must do",
          customPrompt: `List functional requirements with unique IDs. Each requirement should be testable and traceable. Cover: ${topics.slice(0, 3).join(", ") || "core functionality"}.`,
          suggestedTokenBudget: 400,
          children: [],
        },
        {
          title: "Non-Functional Requirements",
          type: "section",
          description: "Quality attributes",
          customPrompt: `Specify non-functional requirements including: performance metrics, security requirements, availability targets, and scalability needs.`,
          suggestedTokenBudget: 400,
          children: [],
        },
      ],
    },
    {
      title: "Architecture",
      type: "chapter",
      description: "System architecture and design",
      customPrompt: `Detail the system architecture for "${title}". Include: architectural patterns used, component diagrams, data flow, and technology stack. Address scalability and maintainability.`,
      suggestedTokenBudget: 800,
      children: [],
    },
    {
      title: "Interface Specifications",
      type: "chapter",
      description: "APIs and integration points",
      customPrompt: `Document interface specifications including: API definitions, data formats, protocols, and integration patterns. Include request/response examples where applicable.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Data Model",
      type: "chapter",
      description: "Data structures and relationships",
      customPrompt: `Define the data model including: entity relationships, data dictionary, storage requirements, and data lifecycle. Include ER diagram references.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Security Considerations",
      type: "section",
      description: "Security architecture and controls",
      customPrompt: `Address security considerations including: authentication, authorization, encryption, audit logging, and compliance requirements. Reference: ${description.slice(0, 100)}.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Testing Strategy",
      type: "section",
      description: "Verification and validation approach",
      customPrompt: `Outline the testing strategy including: test levels, test types, acceptance criteria, and test environment requirements.`,
      suggestedTokenBudget: 400,
      children: [],
    },
  ];
}

/**
 * Business document outline generator
 */
function generateBusinessOutline(title: string, description: string, topics: string[]): OutlineSection[] {
  return [
    {
      title: "Executive Summary",
      type: "chapter",
      description: "Business overview and key points",
      customPrompt: `Write an executive summary for "${title}". Capture: business concept, market opportunity, competitive advantage, financial highlights, and team strengths. Based on: ${description.slice(0, 150)}. Write for investors/stakeholders.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Company Description",
      type: "chapter",
      description: "Organization background and mission",
      customPrompt: `Describe the company/organization including: mission, vision, history, legal structure, and core values. Tie to: ${topics.slice(0, 2).join(", ") || "business objectives"}.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Market Analysis",
      type: "chapter",
      description: "Industry and market assessment",
      customPrompt: `Conduct market analysis including: industry overview, target market segments, market size and growth, customer profiles, and market trends. Reference: ${description.slice(0, 100)}.`,
      suggestedTokenBudget: 800,
      children: [
        {
          title: "Competitive Analysis",
          type: "section",
          description: "Competitive landscape",
          customPrompt: `Analyze the competitive landscape including: key competitors, competitive positioning, differentiation strategy, and barriers to entry.`,
          suggestedTokenBudget: 400,
          children: [],
        },
      ],
    },
    {
      title: "Products/Services",
      type: "chapter",
      description: "Offering description and value proposition",
      customPrompt: `Detail products/services including: features, benefits, unique value proposition, development status, and roadmap. Connect to: ${topics.join(", ") || description.slice(0, 100)}.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Marketing Strategy",
      type: "chapter",
      description: "Go-to-market approach",
      customPrompt: `Outline marketing strategy including: positioning, pricing strategy, distribution channels, promotional tactics, and customer acquisition cost projections.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Operations Plan",
      type: "chapter",
      description: "Operational structure and processes",
      customPrompt: `Describe operations including: facilities, technology infrastructure, supply chain, key processes, and quality control measures.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Management Team",
      type: "section",
      description: "Leadership and organization",
      customPrompt: `Present the management team including: key personnel backgrounds, organizational structure, advisors, and board composition. Highlight relevant experience.`,
      suggestedTokenBudget: 400,
      children: [],
    },
    {
      title: "Financial Projections",
      type: "chapter",
      description: "Financial forecasts and requirements",
      customPrompt: `Provide financial projections including: revenue model, P&L projections (3-5 years), cash flow, break-even analysis, and funding requirements. Include assumptions.`,
      suggestedTokenBudget: 700,
      children: [],
    },
    {
      title: "Risk Assessment",
      type: "section",
      description: "Key risks and mitigation",
      customPrompt: `Assess key risks including: market risks, operational risks, financial risks, and regulatory risks. Provide mitigation strategies for each.`,
      suggestedTokenBudget: 400,
      children: [],
    },
  ];
}

/**
 * Research document outline generator
 */
function generateResearchOutline(title: string, description: string, topics: string[]): OutlineSection[] {
  return [
    {
      title: "Abstract",
      type: "section",
      description: "Research summary",
      customPrompt: `Write an abstract for "${title}". Include: research question, methodology, key findings, and implications. Based on: ${description.slice(0, 150)}. Keep to 250-300 words.`,
      suggestedTokenBudget: 300,
      children: [],
    },
    {
      title: "Introduction",
      type: "chapter",
      description: "Background and research question",
      customPrompt: `Write the introduction covering: background context, problem statement, research questions/hypotheses, and significance. Reference: ${topics.slice(0, 3).join(", ") || description.slice(0, 100)}.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Literature Review",
      type: "chapter",
      description: "Prior research and theoretical framework",
      customPrompt: `Conduct literature review including: theoretical framework, prior research findings, research gaps, and how this study contributes. Focus on: ${topics.join(", ") || "relevant academic literature"}.`,
      suggestedTokenBudget: 800,
      children: [],
    },
    {
      title: "Methodology",
      type: "chapter",
      description: "Research design and methods",
      customPrompt: `Detail the research methodology including: research design, data collection methods, sampling approach, variables/measures, and analysis techniques. Address validity and reliability.`,
      suggestedTokenBudget: 700,
      children: [],
    },
    {
      title: "Results",
      type: "chapter",
      description: "Research findings",
      customPrompt: `Present research results including: descriptive statistics, hypothesis testing results, and data visualizations. Report findings objectively without interpretation.`,
      suggestedTokenBudget: 700,
      children: [],
    },
    {
      title: "Discussion",
      type: "chapter",
      description: "Interpretation and implications",
      customPrompt: `Discuss findings including: interpretation of results, comparison with prior research, theoretical implications, practical applications, and unexpected findings.`,
      suggestedTokenBudget: 800,
      children: [],
    },
    {
      title: "Conclusions",
      type: "section",
      description: "Summary and future directions",
      customPrompt: `Write conclusions including: summary of key findings, limitations, recommendations, and future research directions. Connect back to: ${description.slice(0, 100)}.`,
      suggestedTokenBudget: 400,
      children: [],
    },
    {
      title: "References",
      type: "section",
      description: "Bibliography",
      customPrompt: `Provide placeholder for references section. Note: Include all cited works in appropriate academic format (APA, MLA, Chicago as appropriate).`,
      suggestedTokenBudget: 200,
      children: [],
    },
  ];
}

/**
 * Report outline generator
 */
function generateReportOutline(title: string, description: string, topics: string[]): OutlineSection[] {
  return [
    {
      title: "Executive Summary",
      type: "chapter",
      description: "Key findings and recommendations",
      customPrompt: `Write executive summary for "${title}" including: purpose, key findings, and primary recommendations. Address: ${description.slice(0, 150)}. Make actionable for decision-makers.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Introduction",
      type: "section",
      description: "Report scope and objectives",
      customPrompt: `Introduce the report covering: purpose, scope, methodology overview, and report structure. Reference: ${topics.slice(0, 2).join(", ") || "key assessment areas"}.`,
      suggestedTokenBudget: 400,
      children: [],
    },
    {
      title: "Background",
      type: "chapter",
      description: "Context and current state",
      customPrompt: `Provide background including: historical context, current situation, stakeholders involved, and factors driving this assessment. Based on: ${description.slice(0, 100)}.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Analysis",
      type: "chapter",
      description: "Detailed assessment",
      customPrompt: `Conduct detailed analysis addressing: ${topics.join(", ") || description.slice(0, 150)}. Use data, evidence, and structured frameworks. Include charts/tables where appropriate.`,
      suggestedTokenBudget: 1000,
      children: [],
    },
    {
      title: "Findings",
      type: "chapter",
      description: "Key discoveries",
      customPrompt: `Present findings organized by theme/area. Each finding should include: observation, supporting evidence, impact assessment, and root cause analysis.`,
      suggestedTokenBudget: 700,
      children: [],
    },
    {
      title: "Recommendations",
      type: "chapter",
      description: "Actionable recommendations",
      customPrompt: `Provide recommendations including: priority ranking, implementation steps, resource requirements, expected outcomes, and success metrics. Make practical and actionable.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    {
      title: "Conclusion",
      type: "section",
      description: "Summary and next steps",
      customPrompt: `Conclude with: summary of key points, critical next steps, timeline considerations, and call to action for stakeholders.`,
      suggestedTokenBudget: 300,
      children: [],
    },
    {
      title: "Appendices",
      type: "section",
      description: "Supporting materials",
      customPrompt: `Note: Include appendices for detailed data, methodology details, glossary, and supplementary analysis not suitable for main body.`,
      suggestedTokenBudget: 200,
      children: [],
    },
  ];
}

/**
 * Default outline generator for general documents
 */
function generateDefaultOutline(title: string, description: string, topics: string[]): OutlineSection[] {
  return [
    {
      title: "Introduction",
      type: "chapter",
      description: "Document overview and purpose",
      customPrompt: `Write the introduction for "${title}". Cover: purpose, scope, audience, and document structure. Address key themes: ${topics.slice(0, 3).join(", ") || description.slice(0, 100)}.`,
      suggestedTokenBudget: 500,
      children: [],
    },
    {
      title: "Background",
      type: "chapter",
      description: "Context and foundation",
      customPrompt: `Provide background context for "${title}" including: relevant history, current situation, and factors driving this document. Reference: ${description.slice(0, 150)}.`,
      suggestedTokenBudget: 600,
      children: [],
    },
    ...(topics.length > 0 ? topics.slice(0, 4).map((topic, index) => ({
      title: topic.charAt(0).toUpperCase() + topic.slice(1),
      type: "chapter" as const,
      description: `Coverage of ${topic}`,
      customPrompt: `Write comprehensive content about "${topic}" in the context of "${title}". Include: key concepts, analysis, examples, and implications. Maintain consistency with overall document theme from: ${description.slice(0, 100)}.`,
      suggestedTokenBudget: 600,
      children: [],
    })) : [
      {
        title: "Main Discussion",
        type: "chapter" as const,
        description: "Core content",
        customPrompt: `Write the main content for "${title}" addressing: ${description.slice(0, 200)}. Include analysis, supporting details, and relevant examples.`,
        suggestedTokenBudget: 800,
        children: [],
      },
      {
        title: "Analysis",
        type: "chapter" as const,
        description: "Detailed analysis",
        customPrompt: `Provide analytical depth covering implications, comparisons, and evaluation. Connect to: ${description.slice(0, 100)}.`,
        suggestedTokenBudget: 600,
        children: [],
      },
    ]),
    {
      title: "Recommendations",
      type: "section",
      description: "Suggested actions",
      customPrompt: `Provide actionable recommendations based on the analysis. Include: priority ranking, implementation considerations, and expected outcomes relevant to: ${title}.`,
      suggestedTokenBudget: 400,
      children: [],
    },
    {
      title: "Conclusion",
      type: "section",
      description: "Summary and closing",
      customPrompt: `Write a conclusion summarizing key points, restating main arguments, and providing forward-looking perspective. Reference the core themes from: ${description.slice(0, 100)}.`,
      suggestedTokenBudget: 400,
      children: [],
    },
  ];
}

/**
 * Fallback content generator when AI is not available
 */
function generateFallbackContent(node: HDSINode): string {
  return `# ${node.title}

This is AI-generated content for the "${node.title}" section. It provides comprehensive coverage of the topic with detailed analysis, supporting evidence, and clear conclusions.

## Key Points

1. **Introduction to ${node.title}**: This section covers the fundamental aspects and provides context for understanding the broader implications.

2. **Detailed Analysis**: The content explores multiple dimensions including technical, practical, and strategic considerations relevant to ${node.title}.

3. **Supporting Evidence**: Various data points, case studies, and references support the arguments presented in this section.

4. **Implementation Guidance**: Practical steps and recommendations for applying the concepts discussed.

## Conclusion

The ${node.title} section is crucial for understanding the complete picture. The insights provided here should inform decision-making and guide future actions.

---
*Generated with token budget: ${node.tokenBudget} | Density target: ${node.densityTarget}/5*${node.customPrompt ? `\n\nCustom instructions applied: ${node.customPrompt}` : ""}`;
}
