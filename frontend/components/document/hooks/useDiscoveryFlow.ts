"use client";

/**
 * useDiscoveryFlow Hook
 * 
 * Manages the 4-step AI discovery and outline generation flow:
 * 1. Input - User enters brief
 * 2. Analyzing - AI analyzes requirements
 * 3. Review - User reviews analysis
 * 4. Generate - AI generates outline
 */

import { useState, useCallback } from "react";
import { generateOutlineFromDescription, type OutlineSection } from "@/lib/hdsi/ai-client";
import { convertTemplateToNodes } from "@/lib/hdsi/templates";
import type { HDSINode } from "@/lib/hdsi/types";
import type { DocumentTemplate } from "@/lib/hdsi/templates";

export type DiscoveryStep = "input" | "analyzing" | "review" | "generate";

export interface DiscoveryAnalysis {
  documentIdentification: {
    type: string;
    primaryGoal: string;
    context: string;
  };
  suggestedTitle: string;
  audienceAnalysis: {
    primaryAudience: {
      description: string;
      priorities: string[];
      painPoints: string[];
      knowledgeLevel: string;
    };
    secondaryAudiences: string[];
    keyInformationNeeds: string[];
    criticalQuestions: string[];
    emotionalDrivers: string[];
  };
  contentStrategy: {
    centralThesis: string;
    themes: {
      mustHave: string[];
      shouldHave: string[];
      couldHave: string[];
    };
  };
  persuasionStrategy: {
    evidenceTypes: string[];
    authorityElements: string[];
    potentialObjections: string[];
  };
  stylisticGuidance: {
    recommendedTone: string;
    styleAndComplexity: string;
    formattingSuggestions: string[];
  };
  successCriteria: {
    metrics: string[];
    constraints: string[];
  };
  estimatedSections: number;
}

export interface UseDiscoveryFlowOptions {
  discoveryPrompt: string;
  outlinePrompt: string;
  onDocumentCreated?: (docId: string, title: string, structure: HDSINode[]) => void;
}

export interface UseDiscoveryFlowResult {
  // Step state
  step: DiscoveryStep;
  initialBrief: string;
  setInitialBrief: (brief: string) => void;
  analysis: DiscoveryAnalysis | null;
  
  // Progress
  isAnalyzing: boolean;
  isGenerating: boolean;
  generationProgress: number;
  generationLogs: string[];
  
  // Actions
  startAnalysis: () => Promise<void>;
  approveAndGenerate: () => Promise<void>;
  reset: () => void;
  applyTemplate: (template: DocumentTemplate) => HDSINode[];
  startBlank: () => HDSINode[];
}

export function useDiscoveryFlow(options: UseDiscoveryFlowOptions): UseDiscoveryFlowResult {
  const { discoveryPrompt, outlinePrompt, onDocumentCreated } = options;

  const [step, setStep] = useState<DiscoveryStep>("input");
  const [initialBrief, setInitialBrief] = useState("");
  const [analysis, setAnalysis] = useState<DiscoveryAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);

  // Start discovery analysis
  const startAnalysis = useCallback(async () => {
    if (!initialBrief.trim()) return;

    setStep("analyzing");
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/v1/ai/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: discoveryPrompt },
            {
              role: "user",
              content: `Analyze this document brief:\n\n${initialBrief}\n\nReturn JSON with documentIdentification, suggestedTitle, audienceAnalysis, contentStrategy, persuasionStrategy, stylisticGuidance, successCriteria, estimatedSections`,
            },
          ],
          temperature: 0.7,
          maxTokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error("Discovery analysis failed");
      }

      const data = await response.json();
      const content = data.content || "{}";

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedAnalysis = JSON.parse(jsonMatch[0]) as DiscoveryAnalysis;
        setAnalysis(parsedAnalysis);
        setStep("review");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Discovery analysis error:", error);
      setStep("input");
    } finally {
      setIsAnalyzing(false);
    }
  }, [initialBrief, discoveryPrompt]);

  // Approve analysis and generate outline
  const approveAndGenerate = useCallback(async () => {
    if (!analysis) return;

    setStep("generate");
    setIsGenerating(true);
    setGenerationProgress(10);
    setGenerationLogs(["Starting outline generation..."]);

    try {
      // Build enhanced description from analysis
      const enhancedDescription = buildEnhancedDescription(analysis, initialBrief);

      setGenerationProgress(30);
      setGenerationLogs(prev => [...prev, "Analyzing document requirements..."]);

      // Generate outline with enhanced context
      const outline = await generateOutlineFromDescription(
        analysis.suggestedTitle,
        enhancedDescription
      );

      setGenerationProgress(70);
      setGenerationLogs(prev => [...prev, `Generated ${outline.length} chapters`]);

      // Convert outline to HDSI nodes
      const nodes = convertOutlineToNodes(outline);

      setGenerationProgress(90);
      setGenerationLogs(prev => [...prev, "Building document structure..."]);

      // Save document to database
      const { hdsiDB } = await import("@/lib/hdsi/db");
      const savedDoc = await hdsiDB.createDocument(
        analysis.suggestedTitle,
        nodes,
        {
          isAiGenerated: true,
          metadata: {
            type: "draft",
            generationVersion: "discovery-flow-v1",
          },
        }
      );

      setGenerationProgress(100);
      setGenerationLogs(prev => [
        ...prev,
        `✓ Document saved (v${savedDoc.version})`,
        "✓ Document structure created successfully",
      ]);

      onDocumentCreated?.(savedDoc.id, savedDoc.title, nodes);
    } catch (error) {
      console.error("Outline generation error:", error);
      setStep("review");
    } finally {
      setIsGenerating(false);
    }
  }, [analysis, initialBrief, onDocumentCreated]);

  // Reset flow
  const reset = useCallback(() => {
    setStep("input");
    setInitialBrief("");
    setAnalysis(null);
    setGenerationProgress(0);
    setGenerationLogs([]);
  }, []);

  // Apply a template
  const applyTemplate = useCallback((template: DocumentTemplate): HDSINode[] => {
    return convertTemplateToNodes(template);
  }, []);

  // Start with blank document
  const startBlank = useCallback((): HDSINode[] => {
    return [{
      id: crypto.randomUUID(),
      title: "Introduction",
      type: "chapter",
      order: 0,
      expanded: true,
      customPrompt: "Write an engaging introduction that sets the context and outlines the document's purpose.",
      tokenBudget: 500,
      densityTarget: 3,
      coherenceScore: 0,
      status: "outline",
      depth: 0,
      parentId: null,
      generatedContent: "",
      children: [],
    }];
  }, []);

  return {
    step,
    initialBrief,
    setInitialBrief,
    analysis,
    isAnalyzing,
    isGenerating,
    generationProgress,
    generationLogs,
    startAnalysis,
    approveAndGenerate,
    reset,
    applyTemplate,
    startBlank,
  };
}

// Helper: Build enhanced description from analysis
function buildEnhancedDescription(analysis: DiscoveryAnalysis, originalBrief: string): string {
  return `
DOCUMENT IDENTIFICATION:
- Type: ${analysis.documentIdentification.type}
- Primary Goal: ${analysis.documentIdentification.primaryGoal}
- Context: ${analysis.documentIdentification.context}

Title: ${analysis.suggestedTitle}

PRIMARY AUDIENCE:
${analysis.audienceAnalysis.primaryAudience.description}
- Knowledge Level: ${analysis.audienceAnalysis.primaryAudience.knowledgeLevel}
- Priorities: ${analysis.audienceAnalysis.primaryAudience.priorities.join(", ")}
- Pain Points: ${analysis.audienceAnalysis.primaryAudience.painPoints.join(", ")}

${analysis.audienceAnalysis.secondaryAudiences.length > 0 ? `SECONDARY AUDIENCES:\n${analysis.audienceAnalysis.secondaryAudiences.map((a) => `- ${a}`).join("\n")}\n` : ""}INFORMATION NEEDS:
${analysis.audienceAnalysis.keyInformationNeeds.map((n) => `- ${n}`).join("\n")}

CRITICAL QUESTIONS TO ANSWER:
${analysis.audienceAnalysis.criticalQuestions.map((q) => `- ${q}`).join("\n")}

EMOTIONAL DRIVERS:
${analysis.audienceAnalysis.emotionalDrivers.map((d) => `- ${d}`).join("\n")}

CENTRAL THESIS:
${analysis.contentStrategy.centralThesis}

CONTENT THEMES:
Must-Have: ${analysis.contentStrategy.themes.mustHave.join(", ")}
Should-Have: ${analysis.contentStrategy.themes.shouldHave.join(", ")}
Could-Have: ${analysis.contentStrategy.themes.couldHave.join(", ")}

PERSUASION STRATEGY:
- Evidence Types: ${analysis.persuasionStrategy.evidenceTypes.join(", ")}
- Authority Elements: ${analysis.persuasionStrategy.authorityElements.join(", ")}
- Objections to Address: ${analysis.persuasionStrategy.potentialObjections.join(", ")}

STYLE GUIDANCE:
- Tone: ${analysis.stylisticGuidance.recommendedTone}
- Complexity: ${analysis.stylisticGuidance.styleAndComplexity}
- Formatting: ${analysis.stylisticGuidance.formattingSuggestions.join(", ")}

SUCCESS METRICS: ${analysis.successCriteria.metrics.join(", ")}
CONSTRAINTS: ${analysis.successCriteria.constraints.join(", ")}

ORIGINAL BRIEF:
${originalBrief}
  `.trim();
}

// Helper: Convert AI outline to HDSI nodes
function convertOutlineToNodes(outline: OutlineSection[]): HDSINode[] {
  const convert = (section: OutlineSection, depth: number = 0, parentId?: string): HDSINode => {
    const nodeId = crypto.randomUUID();
    return {
      id: nodeId,
      title: section.title,
      type: section.type,
      order: 0,
      expanded: true,
      customPrompt: section.customPrompt || section.description || "",
      tokenBudget: section.suggestedTokenBudget || 500,
      densityTarget: 3,
      coherenceScore: 0,
      status: "outline",
      depth,
      parentId: parentId || null,
      generatedContent: "",
      children: (section.children || []).map((child, idx) => convert(child, depth + 1, nodeId)),
    };
  };

  return outline.map((section, idx) => convert(section, 0));
}
