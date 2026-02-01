"use client";

/**
 * RAG (Retrieval-Augmented Generation) Pipeline for HDSI
 * Context assembly with vector search, web search, and citation tracking
 */

import { generateEmbedding, cosineSimilarity, semanticSearch, type EmbeddingVector, type SearchResult } from "./embeddings";
import type { HDSINode } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface RAGContext {
  sources: RAGSource[];
  combinedPrompt: string;
  estimatedTokens: number;
  citations: Citation[];
}

export interface RAGSource {
  type: "document" | "web" | "template" | "regulation";
  id: string;
  title: string;
  content: string;
  relevance: number; // 0-1 similarity score
  path?: string[];
}

export interface Citation {
  id: string;
  sourceId: string;
  text: string;
  url?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface ContextAssemblyOptions {
  maxTokens?: number;
  includeWebSearch?: boolean;
  includeSiblings?: boolean;
  includeAncestors?: boolean;
  minRelevance?: number;
  citationStyle?: "numeric" | "parenthetical" | "footnote";
}

// ============================================================================
// Context Assembly
// ============================================================================

export async function assembleRAGContext(
  targetNode: HDSINode,
  allNodes: HDSINode[],
  nodeEmbeddings: EmbeddingVector[],
  options: ContextAssemblyOptions = {}
): Promise<RAGContext> {
  const {
    maxTokens = 4000,
    includeWebSearch = false,
    includeSiblings = true,
    includeAncestors = true,
    minRelevance = 0.6,
  } = options;

  const sources: RAGSource[] = [];
  const citations: Citation[] = [];

  // 1. Semantic search for relevant context
  const query = buildSearchQuery(targetNode);
  const semanticResults = await semanticSearch(query, nodeEmbeddings, {
    topK: 10,
    minScore: minRelevance,
  });

  // Filter out self and add to sources
  for (const result of semanticResults.filter(r => r.nodeId !== targetNode.id)) {
    const node = findNodeById(allNodes, result.nodeId);
    if (node) {
      const source: RAGSource = {
        type: "document",
        id: node.id,
        title: node.title,
        content: extractRelevantContent(node, targetNode),
        relevance: result.score,
        path: getNodePath(allNodes, node.id),
      };
      sources.push(source);
      
      citations.push({
        id: `cite-${citations.length + 1}`,
        sourceId: node.id,
        text: node.title,
      });
    }
  }

  // 2. Add structural context (siblings and ancestors)
  if (includeSiblings) {
    const siblings = findSiblings(allNodes, targetNode.id);
    for (const sibling of siblings) {
      // Only add if not already from semantic search
      if (!sources.find(s => s.id === sibling.id)) {
        sources.push({
          type: "document",
          id: sibling.id,
          title: sibling.title,
          content: sibling.generatedContent || sibling.title,
          relevance: 0.7, // Default relevance for siblings
          path: getNodePath(allNodes, sibling.id),
        });
      }
    }
  }

  if (includeAncestors) {
    const ancestors = findAncestors(allNodes, targetNode.id);
    for (const ancestor of ancestors) {
      if (!sources.find(s => s.id === ancestor.id)) {
        sources.push({
          type: "document",
          id: ancestor.id,
          title: ancestor.title,
          content: ancestor.generatedContent || ancestor.title,
          relevance: 0.8, // Higher relevance for ancestors
          path: getNodePath(allNodes, ancestor.id),
        });
      }
    }
  }

  // 3. Optional web search
  if (includeWebSearch) {
    const webResults = await searchWeb(query);
    for (const result of webResults) {
      sources.push({
        type: "web",
        id: `web-${sources.length}`,
        title: result.title,
        content: result.snippet,
        relevance: 0.5, // Lower relevance for web results
      });
      
      citations.push({
        id: `cite-${citations.length + 1}`,
        sourceId: `web-${sources.length}`,
        text: result.title,
        url: result.url,
      });
    }
  }

  // Sort by relevance
  sources.sort((a, b) => b.relevance - a.relevance);

  // 4. Optimized context assembly (prune to fit token budget)
  const optimized = optimizeContext(sources, maxTokens);

  // 5. Build combined prompt
  const combinedPrompt = buildCombinedPrompt(targetNode, optimized.sources, citations);

  return {
    sources: optimized.sources,
    combinedPrompt,
    estimatedTokens: optimized.tokenCount,
    citations,
  };
}

// ============================================================================
// Dynamic Context Pruning
// ============================================================================

export function optimizeContext(
  sources: RAGSource[],
  maxTokens: number
): { sources: RAGSource[]; tokenCount: number } {
  const estimatedTokensPerChar = 0.25; // Rough estimate
  let currentTokens = 0;
  const optimized: RAGSource[] = [];

  for (const source of sources) {
    const charBudget = Math.min(
      source.content.length,
      (maxTokens - currentTokens) / estimatedTokensPerChar
    );
    
    if (charBudget <= 0) break;

    const truncatedContent = source.content.slice(0, Math.floor(charBudget));
    const tokens = Math.ceil(truncatedContent.length * estimatedTokensPerChar);
    
    optimized.push({
      ...source,
      content: truncatedContent,
    });
    
    currentTokens += tokens;
  }

  return { sources: optimized, tokenCount: currentTokens };
}

// ============================================================================
// Web Search (via API)
// ============================================================================

async function searchWeb(query: string): Promise<WebSearchResult[]> {
  try {
    const response = await fetch("/api/v1/search/web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (!response.ok) return [];
    
    const data = await response.json();
    return data.results || [];
  } catch {
    // Return empty on failure (non-critical)
    return [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildSearchQuery(node: HDSINode): string {
  const parts = [node.title];
  if (node.customPrompt) parts.push(node.customPrompt);
  if (node.generatedContent) parts.push(node.generatedContent.slice(0, 200));
  return parts.join(" ").slice(0, 500);
}

function extractRelevantContent(node: HDSINode, contextNode: HDSINode): string {
  // Priority: generated content > custom prompt + title > just title
  if (node.generatedContent) {
    return node.generatedContent.slice(0, 1000);
  }
  
  if (node.customPrompt) {
    return `${node.title}. ${node.customPrompt}`.slice(0, 500);
  }
  
  return node.title;
}

function buildCombinedPrompt(
  targetNode: HDSINode,
  sources: RAGSource[],
  citations: Citation[]
): string {
  const contextParts: string[] = [];
  
  // Add relevant context from sources
  if (sources.length > 0) {
    contextParts.push("## Relevant Context\n");
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const citation = citations.find(c => c.sourceId === source.id);
      const citationRef = citation ? `[${citation.id}]` : "";
      
      contextParts.push(`### ${source.title}${citationRef}`);
      contextParts.push(source.content);
      contextParts.push("");
    }
  }

  // Main task
  contextParts.push("## Task\n");
  contextParts.push(`Write content for: ${targetNode.title}`);
  contextParts.push(`Type: ${targetNode.type}`);
  
  if (targetNode.customPrompt) {
    contextParts.push(`Instructions: ${targetNode.customPrompt}`);
  }
  
  contextParts.push(`Target length: ${targetNode.tokenBudget} tokens`);
  contextParts.push(`Density: ${targetNode.densityTarget}/5`);

  return contextParts.join("\n");
}

function findNodeById(nodes: HDSINode[], id: string): HDSINode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findSiblings(nodes: HDSINode[], targetId: string): HDSINode[] {
  for (const node of nodes) {
    // Check if target is direct child
    const childIndex = node.children?.findIndex(c => c.id === targetId);
    if (childIndex !== undefined && childIndex !== -1) {
      return node.children?.filter((_, i) => i !== childIndex) || [];
    }
    
    // Recurse
    if (node.children) {
      const result = findSiblings(node.children, targetId);
      if (result.length > 0) return result;
    }
  }
  return [];
}

function findAncestors(nodes: HDSINode[], targetId: string): HDSINode[] {
  const ancestors: HDSINode[] = [];
  
  function find(nodes: HDSINode[], targetId: string, currentPath: HDSINode[]): boolean {
    for (const node of nodes) {
      if (node.id === targetId) {
        ancestors.push(...currentPath);
        return true;
      }
      if (node.children) {
        const found = find(node.children, targetId, [...currentPath, node]);
        if (found) return true;
      }
    }
    return false;
  }
  
  find(nodes, targetId, []);
  return ancestors.reverse(); // Closest first
}

function getNodePath(nodes: HDSINode[], targetId: string): string[] {
  const path: string[] = [];
  
  function find(nodes: HDSINode[], targetId: string): boolean {
    for (const node of nodes) {
      if (node.id === targetId) {
        path.unshift(node.title);
        return true;
      }
      if (node.children && find(node.children, targetId)) {
        path.unshift(node.title);
        return true;
      }
    }
    return false;
  }
  
  find(nodes, targetId);
  return path;
}

// ============================================================================
// Coherence Validation
// ============================================================================

export interface CoherenceReport {
  overallScore: number; // 0-1
  termConsistency: number;
  thematicDrift: number;
  suggestions: string[];
}

export async function validateCoherence(
  nodes: HDSINode[],
  embeddings: EmbeddingVector[]
): Promise<CoherenceReport> {
  if (nodes.length < 2) {
    return { overallScore: 1.0, termConsistency: 1.0, thematicDrift: 0, suggestions: [] };
  }

  // Calculate pairwise similarities
  let totalSimilarity = 0;
  let pairCount = 0;
  const driftNodes: string[] = [];

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const sim = cosineSimilarity(embeddings[i].embedding, embeddings[j].embedding);
      totalSimilarity += sim;
      pairCount++;
      
      // Flag low similarity pairs as drift
      if (sim < 0.5) {
        driftNodes.push(`${embeddings[i].metadata.title} ↔ ${embeddings[j].metadata.title}`);
      }
    }
  }

  const avgSimilarity = totalSimilarity / pairCount;

  return {
    overallScore: avgSimilarity,
    termConsistency: avgSimilarity,
    thematicDrift: 1 - avgSimilarity,
    suggestions: driftNodes.length > 0 
      ? [`Consider reconciling these divergent sections: ${driftNodes.slice(0, 3).join("; ")}`]
      : ["Document coherence looks good!"],
  };
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useCallback } from "react";

export function useRAG() {
  const [context, setContext] = useState<RAGContext | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);

  const assembleContext = useCallback(async (
    targetNode: HDSINode,
    allNodes: HDSINode[],
    embeddings: EmbeddingVector[],
    options?: ContextAssemblyOptions
  ) => {
    setIsAssembling(true);
    try {
      const ctx = await assembleRAGContext(targetNode, allNodes, embeddings, options);
      setContext(ctx);
      return ctx;
    } finally {
      setIsAssembling(false);
    }
  }, []);

  const clearContext = useCallback(() => {
    setContext(null);
  }, []);

  return {
    context,
    isAssembling,
    assembleContext,
    clearContext,
  };
}
