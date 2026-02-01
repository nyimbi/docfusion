"use client";

/**
 * Multi-model AI generation for HDSI
 * Supports: Azure OpenAI, OpenAI, Anthropic, and Local models
 */

import type { HDSINode, ModelConfig, GenerationOptions, GenerationProgress, GenerationResult } from "./types";

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_CONFIGS: Record<string, ModelConfig> = {
  azure: {
    provider: "azure",
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.9,
  },
  "azure-fast": {
    provider: "azure",
    model: "gpt-35-turbo",
    temperature: 0.5,
    maxTokens: 1500,
    topP: 0.9,
  },
  "openai-gpt4": {
    provider: "openai",
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.9,
  },
  anthropic: {
    provider: "anthropic",
    model: "claude-3-sonnet",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1.0,
  },
  local: {
    provider: "local",
    model: "llama2-13b",
    temperature: 0.8,
    maxTokens: 1000,
  },
};

// ============================================================================
// Main Generation Functions
// ============================================================================

/**
 * Generate content for a single node with full context
 */
export async function generateNodeContent(
  node: HDSINode,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const config = options.model || DEFAULT_CONFIGS.azure;
  const startTime = Date.now();

  try {
    // Build context from parent and sibling nodes
    const context = buildGenerationContext(node, options.contextNodes);

    // Simulate API call (replace with real implementation)
    const content = await simulateApiCall(node, context, config);
    
    // Calculate coherence score
    const coherenceScore = calculateCoherenceScore(content, context);
    const tokensUsed = estimateTokensFromText(content);

    return {
      content,
      tokensUsed,
      latencyMs: Date.now() - startTime,
      model: config.model,
      coherenceScore,
    };
  } catch (error) {
    console.error("Generation failed:", error);
    throw error;
  }
}

/**
 * Generate multiple nodes with intelligent batching
 */
export async function generateBatch(
  nodes: HDSINode[],
  options: GenerationOptions = {}
): Promise<Map<string, GenerationResult>> {
  const results = new Map<string, GenerationResult>();

  // Process sequentially to maintain context flow
  for (const node of nodes) {
    try {
      const result = await generateNodeContent(node, {
        ...options,
        contextNodes: [...nodes], // Pass all siblings for context
      });

      results.set(node.id, result);

      options.onProgress?.({
        phase: "content",
        nodeId: node.id,
        percentage: Math.round((results.size / nodes.length) * 100),
        tokensUsed: result.tokensUsed,
      });
    } catch (error) {
      console.error(`Failed to generate node ${node.id}:`, error);
      // Continue with other nodes
    }
  }

  return results;
}

/**
 * Streaming generation with real-time updates
 */
export async function* generateNodeStreaming(
  node: HDSINode,
  options: GenerationOptions = {}
): AsyncGenerator<GenerationProgress, GenerationResult, unknown> {
  const config = options.model || DEFAULT_CONFIGS.azure;
  const startTime = Date.now();
  let accumulatedContent = "";

  // Simulate streaming (replace with real SSE connection)
  const chunks = simulateStreamingChunks();

  for (const chunk of chunks) {
    accumulatedContent += chunk;

    yield {
      phase: "content",
      nodeId: node.id,
      percentage: Math.round((accumulatedContent.length / node.tokenBudget) * 100),
      tokensUsed: estimateTokensFromText(accumulatedContent),
      chunk,
    };

    await delay(100); // Simulate network latency
  }

  // Final result after streaming completes
  const coherenceScore = Math.min(1.0, estimateTokensFromText(accumulatedContent) / node.tokenBudget);

  return {
    content: accumulatedContent,
    tokensUsed: estimateTokensFromText(accumulatedContent),
    latencyMs: Date.now() - startTime,
    model: config.model,
    coherenceScore,
  };
}

/**
 * Generate document outline from template or content
 */
export async function generateOutlineFromTemplate(
  templateContent: any, // JSONContent from novel
  prompt: string,
  options: GenerationOptions = {}
): Promise<HDSINode[]> {
  // Simulation - in real implementation would call server action
  const structure: HDSINode[] = [
    {
      id: crypto.randomUUID(),
      type: "chapter",
      title: "Introduction",
      order: 1,
      expanded: true,
      status: "outline",
      tokenBudget: 500,
      customPrompt: "",
      densityTarget: 2.5,
      coherenceScore: 1.0,
      children: [],
      depth: 0,
    },
  ];
  
  return structure;
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildGenerationContext(node: HDSINode, siblings?: HDSINode[]) {
  const defaultPrompts: Record<string, string> = {
    chapter: `Write a comprehensive chapter titled "${node.title}". Maintain consistent terminology with adjacent sections.`,
    section: `Develop a detailed section on "${node.title}" that supports parent themes.`,
    paragraph: `Write a focused paragraph addressing: ${node.title}`,
  };

  const siblingContext = siblings
    ?.filter((s) => s.id !== node.id)
    .slice(-2) // Only last 2 siblings for context window
    .map((s) => `${s.title}: ${s.generatedContent?.slice(0, 200) || "outline"}`)
    .join("\n");

  return {
    defaultPrompt: defaultPrompts[node.type] || `Write about: ${node.title}`,
    siblingSummaries: siblingContext || "",
  };
}

function calculateCoherenceScore(
  content: string,
  context: { siblingSummaries: string }
): number {
  // Simplified coherence scoring
  const contentTerms = content.toLowerCase().split(/\s+/);
  const contextTerms = context.siblingSummaries.toLowerCase().split(/\s+/);

  const overlap = contextTerms.filter((term) => 
    term.length > 3 && contentTerms.includes(term)
  ).length;
  
  return Math.min(1.0, 0.5 + overlap * 0.05);
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Utilities
// ============================================================================

function simulateStreamingChunks(): string[] {
  const sample = `
    This is generated content that simulates real streaming output from a language model.
    Each chunk represents tokens being generated progressively, allowing the UI to show
    real-time progress as content is being created. In a real implementation, this would
    come from a Server-Sent Events stream connecting to the AI provider.
  `;

  // Split into word-sized chunks
  return sample.trim().split(/\s+/).map((w) => w + " ");
}

function simulateApiCall(
  node: HDSINode,
  context: { defaultPrompt: string; siblingSummaries: string },
  config: ModelConfig
): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`Generated content for "${node.title}" using ${config.provider} ${config.model}.

${context.defaultPrompt}

Token budget: ${node.tokenBudget}
Density target: ${node.densityTarget}
Custom prompt: ${node.customPrompt || "None provided"}`);
    }, 1000);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGenerationQueue(parallelism = 2) {
  let running = 0;
  const queue: Array<{
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  async function processQueue() {
    if (queue.length === 0 || running >= parallelism) return;

    running++;
    const item = queue.shift()!;

    try {
      const result = await item.execute();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      running--;
      processQueue();
    }
  }

  return {
    add<T>(execute: () => Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        queue.push({ execute, resolve, reject });
        processQueue();
      });
    },
    get size() {
      return queue.length;
    },
    get active() {
      return running;
    },
  };
}
