"use client";

/**
 * Fine-tuned Domain Models via LoRA
 * Specialized adapters for FAR/DFARS, technical specs, academic papers
 */

import type { HDSINode } from "./types";

// ============================================================================
// Domain Types
// ============================================================================

export type DomainType = 
  | "far-compliance"      // Federal Acquisition Regulation
  | "dfars-compliance"    // Defense Federal Acquisition Regulation
  | "technical-spec"      // Technical specifications (SYSML, DoDAF)
  | "academic"            // Academic papers
  | "grant-proposal"      // Grant/Funding proposals
  | "medical-device"      // FDA medical device submissions
  | "software-rfp"        // Software development RFPs
  | "construction"        // Construction/construction management
  | "general";            // Fallback to base model

export interface DomainAdapter {
  id: DomainType;
  name: string;
  description: string;
  baseModel: string;
  adapterPath: string;      // HuggingFace or local path
  triggerWords: string[];   // Words that activate the adapter
  temperature: number;      // Optimal temp for this domain
  maxTokens: number;
  systemPrompt: string;
}

export interface DomainDetectionResult {
  detectedDomain: DomainType;
  confidence: number;
  triggerMatches: string[];
  suggestedAdapter: DomainAdapter;
}

// ============================================================================
// Domain Adapters Configuration
// ============================================================================

export const DOMAIN_ADAPTERS: Record<DomainType, DomainAdapter> = {
  "far-compliance": {
    id: "far-compliance",
    name: "FAR Compliance",
    description: "Federal Acquisition Regulation clause interpretation and compliance",
    baseModel: "gpt-4",
    adapterPath: "docfusion/lora-far-v2",
    triggerWords: ["FAR", "clause", "acquisition", "contract", "procurement", "solicitation"],
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt: `You are a FAR compliance expert. Your responses must:
- Reference specific FAR clauses (e.g., FAR 52.219-9)
- Use appropriate contract terminology
- Address small business requirements
- Include required flow-down clauses
- Follow federal contracting conventions`,
  },
  
  "dfars-compliance": {
    id: "dfars-compliance",
    name: "DFARS Compliance",
    description: "Defense Federal Acquisition Regulation for DoD contracts",
    baseModel: "gpt-4",
    adapterPath: "docfusion/lora-dfars-v1",
    triggerWords: ["DFARS", "DoD", "defense", "security", "ITAR", "cybersecurity", "CMMC"],
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt: `You are a DFARS and DoD contracting expert. Your responses must:
- Reference DFARS clauses and provisions
- Address cybersecurity (DFARS 252.204-7012)
- Consider CMMC requirements
- Handle ITAR/EAR export control
- Use defense contracting terminology`,
  },
  
  "technical-spec": {
    id: "technical-spec",
    name: "Technical Specification",
    description: "System modeling with SYSML, DoDAF, and technical architecture",
    baseModel: "gpt-4",
    adapterPath: "docfusion/lora-techspec-v2",
    triggerWords: ["SYSML", "DoDAF", "architecture", "system", "technical", "requirement", "interface"],
    temperature: 0.4,
    maxTokens: 2500,
    systemPrompt: `You are a technical specification expert. Your responses must:
- Use precise technical terminology
- Reference interfaces and boundaries
- Address performance characteristics
- Include verifiable requirements
- Use appropriate modeling conventions`,
  },
  
  "academic": {
    id: "academic",
    name: "Academic Paper",
    description: "Research papers, journal articles, and academic writing",
    baseModel: "gpt-4",
    adapterPath: "docfusion/lora-academic-v3",
    triggerWords: ["research", "study", "hypothesis", "methodology", "literature", "citation", "peer-review"],
    temperature: 0.5,
    maxTokens: 3000,
    systemPrompt: `You are an academic writing expert. Your responses must:
- Use formal academic tone
- Include proper citation format
- Address methodology clearly
- Discuss limitations
- Follow IMRAD structure where appropriate`,
  },
  
  "grant-proposal": {
    id: "grant-proposal",
    name: "Grant Proposal",
    description: "NSF, NIH, SBIR, and other funding proposals",
    baseModel: "gpt-4",
    adapterPath: "docfusion/lora-grant-v2",
    triggerWords: ["grant", "funding", "NSF", "NIH", "SBIR", "STTR", "broader impacts"],
    temperature: 0.5,
    maxTokens: 2500,
    systemPrompt: `You are a grant writing expert. Your responses must:
- Address evaluation criteria
- Include broader impacts
- Follow agency-specific requirements
- Use persuasive but factual tone
- Address innovation and significance`,
  },
  
  "medical-device": {
    id: "medical-device",
    name: "Medical Device FDA",
    description: "FDA 510(k), PMA, and medical device submissions",
    baseModel: "gpt-4",
    adapterPath: "docfusion/lora-fda-v1",
    triggerWords: ["FDA", "510(k)", "PMA", "medical device", "regulatory", "clinical", "biocompatibility"],
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt: `You are a medical device regulatory expert. Your responses must:
- Reference FDA requirements
- Include risk management (ISO 14971)
- Address biocompatibility (ISO 10993)
- Consider software as medical device (SaMD)
- Use regulatory terminology`,
  },
  
  "software-rfp": {
    id: "software-rfp",
    name: "Software RFP",
    description: "Software development requests for proposals",
    baseModel: "gpt-4",
    adapterPath: "docfusion/lora-softwarerfp-v1",
    triggerWords: ["software", "development", "Agile", "DevSecOps", "API", "microservices", "cloud"],
    temperature: 0.4,
    maxTokens: 2000,
    systemPrompt: `You are a software procurement expert. Your responses must:
- Include technical evaluation criteria
- Address security requirements
- Consider CI/CD pipelines
- Reference appropriate standards (NIST 800-53)
- Include SLAs and support requirements`,
  },
  
  "construction": {
    id: "construction",
    name: "Construction/Management",
    description: "Construction contracts and project management",
    baseModel: "gpt-4",
    adapterPath: "docfusion/lora-construction-v1",
    triggerWords: ["construction", "contractor", "subcontractor", "AIA", "blueprint", "specification"],
    temperature: 0.4,
    maxTokens: 2000,
    systemPrompt: `You are a construction contracting expert. Your responses must:
- Reference AIA contract documents
- Address safety requirements (OSHA)
- Include coordination requirements
- Consider change order procedures
- Use construction industry terminology`,
  },
  
  "general": {
    id: "general",
    name: "General",
    description: "No domain specialization - use base model",
    baseModel: "gpt-4",
    adapterPath: "",
    triggerWords: [],
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: "You are a helpful assistant for general document writing.",
  },
};

// ============================================================================
// Domain Detection
// ============================================================================

export function detectDomain(
  content: string,
  options: { threshold?: number } = {}
): DomainDetectionResult {
  const { threshold = 0.3 } = options;
  const text = content.toLowerCase();
  
  let bestDomain: DomainType = "general";
  let bestScore = 0;
  let bestMatches: string[] = [];
  
  for (const [domainId, adapter] of Object.entries(DOMAIN_ADAPTERS)) {
    if (domainId === "general") continue;
    
    const matches = adapter.triggerWords.filter(word => 
      text.includes(word.toLowerCase())
    );
    
    const score = matches.length / adapter.triggerWords.length;
    
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestDomain = domainId as DomainType;
      bestMatches = matches;
    }
  }
  
  return {
    detectedDomain: bestDomain,
    confidence: bestScore,
    triggerMatches: bestMatches,
    suggestedAdapter: DOMAIN_ADAPTERS[bestDomain],
  };
}

export function detectDomainForNode(node: HDSINode): DomainDetectionResult {
  const content = `${node.title} ${node.customPrompt || ""} ${node.generatedContent || ""}`;
  return detectDomain(content);
}

export function detectDomainForDocument(nodes: HDSINode[]): DomainDetectionResult {
  // Combine all node content
  const allContent = nodes.map(n => 
    `${n.title} ${n.customPrompt || ""} ${n.generatedContent || ""}`
  ).join(" ");
  
  return detectDomain(allContent, { threshold: 0.2 });
}

// ============================================================================
// Adapter Loading & Generation
// ============================================================================

export interface DomainGenerationOptions {
  domain: DomainType;
  prompt: string;
  nodeContext?: HDSINode;
  streaming?: boolean;
  onProgress?: (progress: { tokens: number; content: string }) => void;
}

export interface DomainGenerationResult {
  content: string;
  domain: DomainType;
  adapterUsed: DomainAdapter;
  tokensUsed: number;
  complianceScore?: number;  // 0-1 score for regulatory compliance
}

/**
 * Generate content with domain-specific adapter
 */
export async function generateWithDomainAdapter(
  options: DomainGenerationOptions
): Promise<DomainGenerationResult> {
  const { domain, prompt, nodeContext, streaming, onProgress } = options;
  const adapter = DOMAIN_ADAPTERS[domain];
  
  // Build domain-specific prompt
  const fullPrompt = `${adapter.systemPrompt}

Context: ${nodeContext ? buildNodeContext(nodeContext) : "None"}

Task: ${prompt}

Generate content appropriate for ${adapter.name}:`;

  // In production, this would:
  // 1. Load the LoRA adapter if available
  // 2. Apply the adapter to the base model
  // 3. Generate with domain-specific parameters
  
  // For now, simulate with higher quality
  const startTime = Date.now();
  
  // Generate domain-specific content using AI
  const content = await generateDomainContent(fullPrompt, adapter);
  
  // Calculate compliance score for regulated domains
  const complianceScore = ["far-compliance", "dfars-compliance", "medical-device"].includes(domain)
    ? calculateComplianceScore(content, adapter)
    : undefined;
  
  return {
    content,
    domain,
    adapterUsed: adapter,
    tokensUsed: Math.ceil(content.length / 4),
    complianceScore,
  };
}

function buildNodeContext(node: HDSINode): string {
  const parts = [
    `Type: ${node.type}`,
    `Title: ${node.title}`,
  ];
  
  if (node.customPrompt) parts.push(`Instructions: ${node.customPrompt}`);
  if (node.densityTarget) parts.push(`Density: ${node.densityTarget}/5`);
  if (node.tokenBudget) parts.push(`Target Length: ${node.tokenBudget} tokens`);
  
  return parts.join("\n");
}

function calculateComplianceScore(content: string, adapter: DomainAdapter): number {
  // Check for required elements based on domain
  let score = 0.5; // Base score
  const text = content.toLowerCase();
  
  switch (adapter.id) {
    case "far-compliance":
      if (text.includes("clause")) score += 0.1;
      if (text.includes("52.")) score += 0.1; // FAR clause format
      if (text.includes("small business")) score += 0.1;
      if (text.includes("flow-down")) score += 0.1;
      if (text.includes("certification")) score += 0.1;
      break;
      
    case "dfars-compliance":
      if (text.includes("252.")) score += 0.15; // DFARS clause format
      if (text.includes("cybersecurity")) score += 0.1;
      if (text.includes("cmmc")) score += 0.1;
      if (text.includes("itar")) score += 0.1;
      break;
      
    case "medical-device":
      if (text.includes("510(k)")) score += 0.15;
      if (text.includes("risk")) score += 0.1;
      if (text.includes("biocompatibility")) score += 0.1;
      if (text.includes("clinical")) score += 0.1;
      break;
  }
  
  return Math.min(1.0, score);
}

async function generateDomainContent(prompt: string, adapter: DomainAdapter): Promise<string> {
  try {
    // Call AI completion API with domain-specific adapter settings
    const response = await fetch('/api/v1/ai/completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: adapter.systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: adapter.temperature,
        maxTokens: adapter.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error('AI completion failed');
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    return data.content || "";
  } catch (error) {
    console.error(`Domain generation error (${adapter.name}):`, error);
    // Return error message instead of mock content
    return `[Error generating ${adapter.name} content: ${error instanceof Error ? error.message : "Unknown error"}]

Please ensure the AI provider is configured and try again.`;
  }
}

// ============================================================================
// React Hooks
// ============================================================================

import { useState, useCallback } from "react";

export function useDomainDetection() {
  const [detectedDomain, setDetectedDomain] = useState<DomainType>("general");
  const [confidence, setConfidence] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);

  const detect = useCallback(async (content: string) => {
    setIsDetecting(true);
    try {
      const result = detectDomain(content);
      setDetectedDomain(result.detectedDomain);
      setConfidence(result.confidence);
      return result;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const detectForNode = useCallback((node: HDSINode) => {
    const result = detectDomainForNode(node);
    setDetectedDomain(result.detectedDomain);
    setConfidence(result.confidence);
    return result;
  }, []);

  return {
    detectedDomain,
    confidence,
    isDetecting,
    adapter: DOMAIN_ADAPTERS[detectedDomain],
    detect,
    detectForNode,
  };
}

export function useDomainGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DomainGenerationResult | null>(null);

  const generate = useCallback(async (options: DomainGenerationOptions) => {
    setIsGenerating(true);
    try {
      const result = await generateWithDomainAdapter(options);
      setResult(result);
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    isGenerating,
    result,
    generate,
    clear: () => setResult(null),
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

export async function generateWithOptimalDomain(
  nodes: HDSINode[],
  options: {
    autoDetect?: boolean;
    defaultDomain?: DomainType;
  } = {}
): Promise<Map<string, DomainGenerationResult>> {
  const { autoDetect = true, defaultDomain = "general" } = options;
  
  const results = new Map<string, DomainGenerationResult>();
  
  for (const node of nodes) {
    const domain = autoDetect 
      ? detectDomainForNode(node).detectedDomain 
      : defaultDomain;
    
    const result = await generateWithDomainAdapter({
      domain,
      prompt: node.customPrompt || `Write content for: ${node.title}`,
      nodeContext: node,
    });
    
    results.set(node.id, result);
  }
  
  return results;
}
