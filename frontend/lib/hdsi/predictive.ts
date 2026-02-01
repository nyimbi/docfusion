"use client";

/**
 * Predictive Content Generation (Speculative Execution)
 * Pre-generates likely next sections for instant delivery
 */

import type { HDSINode } from "./types";
import { detectDomainForNode, generateWithDomainAdapter, type DomainType } from "./domain-models";

// ============================================================================
// Types
// ============================================================================

export interface PredictionCandidate {
  nodeId: string;
  node: HDSINode;
  confidence: number;      // 0-1 likelihood this node will be edited
  predictedDelay: number;  // Estimated ms before user navigates here
  priority: number;        // Generation priority score
}

export interface PredictedContent {
  nodeId: string;
  content: string;
  generatedAt: Date;
  model: string;
  tokensUsed: number;
  isStale: boolean;
}

export interface PredictionStats {
  totalPredictions: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatency: number;
  hitRate: number;
}

// ============================================================================
// Predictive Generator
// ============================================================================

export class PredictiveGenerator {
  private cache = new Map<string, PredictedContent>();
  private inFlight = new Map<string, Promise<PredictedContent>>();
  private recentNavigations: Array<{ from: string; to: string; timestamp: number }> = [];
  private editHistory: Array<{ nodeId: string; timestamp: number; editType: string }> = [];
  private stats: PredictionStats = {
    totalPredictions: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgLatency: 0,
    hitRate: 0,
  };

  /**
   * Predict which nodes will be edited next based on:
   * - Current cursor position
   * - Edit history patterns
   * - Document structure progression
   * - Time spent on current node
   */
  predictCandidates(
    currentNodeId: string,
    allNodes: HDSINode[],
    options: {
      maxCandidates?: number;
      lookaheadMs?: number;
    } = {}
  ): PredictionCandidate[] {
    const { maxCandidates = 3, lookaheadMs = 30000 } = options;
    
    const candidates: PredictionCandidate[] = [];
    const currentNode = findNodeById(allNodes, currentNodeId);
    
    if (!currentNode) return candidates;

    // 1. Next sibling (sequential editing pattern)
    const nextSibling = findNextSibling(allNodes, currentNodeId);
    if (nextSibling) {
      candidates.push({
        nodeId: nextSibling.id,
        node: nextSibling,
        confidence: this.calculateConfidence("sibling", currentNodeId, nextSibling.id),
        predictedDelay: 5000, // 5s to move to next
        priority: 0.9,
      });
    }

    // 2. First child (drill-down pattern)
    if (currentNode.children && currentNode.children.length > 0) {
      const firstChild = currentNode.children[0];
      if (firstChild.status === "outline") {
        candidates.push({
          nodeId: firstChild.id,
          node: firstChild,
          confidence: this.calculateConfidence("child", currentNodeId, firstChild.id),
          predictedDelay: 3000,
          priority: 0.8,
        });
      }
    }

    // 3. Parent's next sibling (up-then-next pattern)
    const parentNextSibling = findParentNextSibling(allNodes, currentNodeId);
    if (parentNextSibling && parentNextSibling.status === "outline") {
      candidates.push({
        nodeId: parentNextSibling.id,
        node: parentNextSibling,
        confidence: this.calculateConfidence("parent_sibling", currentNodeId, parentNextSibling.id),
        predictedDelay: 15000,
        priority: 0.6,
      });
    }

    // 4. Same-level nodes in other branches (related content)
    const similarNodes = findSimilarNodesByType(allNodes, currentNodeId, currentNode.type);
    for (const similar of similarNodes.slice(0, 2)) {
      if (similar.status === "outline") {
        candidates.push({
          nodeId: similar.id,
          node: similar,
          confidence: this.calculateConfidence("similar", currentNodeId, similar.id) * 0.7,
          predictedDelay: 20000,
          priority: 0.5,
        });
      }
    }

    // Sort by priority and return top N
    return candidates
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxCandidates);
  }

  /**
   * Pre-generate content for predicted nodes
   */
  async pregenerate(
    candidates: PredictionCandidate[],
    options: {
      lowPriority?: boolean;
      domain?: DomainType;
    } = {}
  ): Promise<void> {
    const sorted = candidates.sort((a, b) => b.priority - a.priority);
    
    for (const candidate of sorted) {
      // Skip if already cached or in-flight
      if (this.cache.has(candidate.nodeId)) continue;
      if (this.inFlight.has(candidate.nodeId)) continue;

      // Generate with low priority flag
      const generationPromise = this.generateForCandidate(candidate, options.domain);
      this.inFlight.set(candidate.nodeId, generationPromise);
      
      // Wait for completion and move to cache
      try {
        const result = await generationPromise;
        this.cache.set(candidate.nodeId, result);
        this.inFlight.delete(candidate.nodeId);
        this.stats.totalPredictions++;
      } catch (error) {
        this.inFlight.delete(candidate.nodeId);
      }
    }
  }

  /**
   * Get predicted content if available
   */
  async getPredicted(nodeId: string): Promise<PredictedContent | null> {
    // Check cache first
    const cached = this.cache.get(nodeId);
    if (cached && !cached.isStale) {
      this.stats.cacheHits++;
      this.updateHitRate();
      return cached;
    }

    // Check in-flight generation
    const inFlight = this.inFlight.get(nodeId);
    if (inFlight) {
      try {
        const result = await inFlight;
        this.stats.cacheHits++;
        return result;
      } catch {
        return null;
      }
    }

    this.stats.cacheMisses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Record navigation for pattern learning
   */
  recordNavigation(fromNodeId: string, toNodeId: string): void {
    this.recentNavigations.push({
      from: fromNodeId,
      to: toNodeId,
      timestamp: Date.now(),
    });

    // Keep only last 100 navigations
    if (this.recentNavigations.length > 100) {
      this.recentNavigations.shift();
    }
  }

  /**
   * Record edit for pattern learning
   */
  recordEdit(nodeId: string, editType: string): void {
    this.editHistory.push({
      nodeId,
      editType,
      timestamp: Date.now(),
    });

    // Keep only last 50 edits
    if (this.editHistory.length > 50) {
      this.editHistory.shift();
    }
  }

  /**
   * Invalidate stale predictions
   */
  invalidate(nodes: string[]): void {
    for (const nodeId of nodes) {
      const cached = this.cache.get(nodeId);
      if (cached) {
        cached.isStale = true;
      }
    }
  }

  /**
   * Clear all predictions
   */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Get prediction statistics
   */
  getStats(): PredictionStats {
    return { ...this.stats };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private calculateConfidence(
    relationType: string,
    fromId: string,
    toId: string
  ): number {
    let baseConfidence = 0.7;

    // Boost if this navigation pattern exists in history
    const patternCount = this.recentNavigations.filter(
      nav => nav.from === fromId && nav.to === toId
    ).length;
    
    if (patternCount > 0) {
      baseConfidence += Math.min(0.2, patternCount * 0.05);
    }

    // Boost if destination was recently edited
    const recentEdits = this.editHistory.filter(
      edit => edit.nodeId === toId
    ).length;
    
    if (recentEdits > 0) {
      baseConfidence += Math.min(0.1, recentEdits * 0.02);
    }

    // Reduce confidence based on relation type
    const typeMultiplier: Record<string, number> = {
      sibling: 1.0,
      child: 0.9,
      parent_sibling: 0.6,
      similar: 0.5,
    };

    return Math.min(1.0, baseConfidence * (typeMultiplier[relationType] || 0.5));
  }

  private async generateForCandidate(
    candidate: PredictionCandidate,
    domain?: DomainType
  ): Promise<PredictedContent> {
    const detected = domain || detectDomainForNode(candidate.node).detectedDomain;
    
    const result = await generateWithDomainAdapter({
      domain: detected,
      prompt: candidate.node.customPrompt || `Write: ${candidate.node.title}`,
      nodeContext: candidate.node,
    });

    return {
      nodeId: candidate.nodeId,
      content: result.content,
      generatedAt: new Date(),
      model: result.adapterUsed.name,
      tokensUsed: result.tokensUsed,
      isStale: false,
    };
  }

  private updateHitRate(): void {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    this.stats.hitRate = total > 0 ? this.stats.cacheHits / total : 0;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

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

function findNextSibling(nodes: HDSINode[], targetId: string): HDSINode | null {
  for (const node of nodes) {
    const children = node.children || [];
    const index = children.findIndex(c => c.id === targetId);
    
    if (index !== -1 && index < children.length - 1) {
      return children[index + 1];
    }
    
    const found = findNextSibling(children, targetId);
    if (found) return found;
  }
  return null;
}

function findParentNextSibling(nodes: HDSINode[], targetId: string): HDSINode | null {
  for (const node of nodes) {
    const children = node.children || [];
    if (children.some(c => c.id === targetId)) {
      // Found parent, now find parent's next sibling
      return findNextSibling(nodes, node.id);
    }
    
    const found = findParentNextSibling(children, targetId);
    if (found) return found;
  }
  return null;
}

function findSimilarNodesByType(
  nodes: HDSINode[],
  excludeId: string,
  type: string
): HDSINode[] {
  const similar: HDSINode[] = [];
  
  function traverse(nodes: HDSINode[]) {
    for (const node of nodes) {
      if (node.id !== excludeId && node.type === type) {
        similar.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  
  traverse(nodes);
  return similar;
}

// ============================================================================
// Singleton
// ============================================================================

export const predictiveGenerator = new PredictiveGenerator();

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";

export function usePredictiveGeneration(
  documentId: string | undefined,
  currentNodeId: string | null,
  allNodes: HDSINode[]
) {
  const [predictedCandidates, setPredictedCandidates] = useState<PredictionCandidate[]>([]);
  const [cachedContent, setCachedContent] = useState<Map<string, PredictedContent>>(new Map());
  const [stats, setStats] = useState<PredictionStats>({
    totalPredictions: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgLatency: 0,
    hitRate: 0,
  });
  
  const generatorRef = useRef(new PredictiveGenerator());

  // Update predictions when current node changes
  useEffect(() => {
    if (!currentNodeId || allNodes.length === 0) return;

    const generator = generatorRef.current;
    
    // Record navigation
    if (documentId) {
      const lastNav = generator["recentNavigations"][generator["recentNavigations"].length - 1];
      if (lastNav) {
        generator.recordNavigation(lastNav.to, currentNodeId);
      }
    }

    // Predict next candidates
    const candidates = generator.predictCandidates(currentNodeId, allNodes);
    setPredictedCandidates(candidates);

    // Pre-generate in background
    generator.pregenerate(candidates).then(async () => {
      // Update cached content
      const newCache = new Map<string, PredictedContent>();
      for (const candidate of candidates) {
        const content = await generator.getPredicted(candidate.nodeId);
        if (content) {
          newCache.set(candidate.nodeId, content);
        }
      }
      setCachedContent(newCache);
      setStats(generator.getStats());
    });
  }, [currentNodeId, allNodes, documentId]);

  const getPredicted = useCallback(async (nodeId: string): Promise<string | null> => {
    // Check local cache first
    const local = cachedContent.get(nodeId);
    if (local) return local.content;

    // Try generator
    const fromGenerator = await generatorRef.current.getPredicted(nodeId);
    return fromGenerator?.content || null;
  }, [cachedContent]);

  const recordEdit = useCallback((nodeId: string, editType: string) => {
    generatorRef.current.recordEdit(nodeId, editType);
  }, []);

  return {
    predictedCandidates,
    cachedContent,
    stats,
    getPredicted,
    recordEdit,
  };
}
