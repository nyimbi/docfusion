"use client";

/**
 * useContextBuffer Hook
 * 
 * Manages context buffer assembly for AI generation.
 * Assembles context from local node, siblings, and parent/document context.
 */

import { useState, useCallback, useEffect } from "react";
import type { HDSINode, ContextBuffer, ContextBufferEntry } from "@/lib/hdsi/types";

const MAX_TOKENS = 3800;

export interface UseContextBufferOptions {
  structure: HDSINode[];
  selectedNodeId: string | null;
  enableAutoAssembly?: boolean;
}

export interface UseContextBufferResult {
  buffer: ContextBuffer;
  isAssembling: boolean;
  assembleContext: (nodeId: string) => Promise<void>;
  refreshContext: () => Promise<void>;
}

export function useContextBuffer(options: UseContextBufferOptions): UseContextBufferResult {
  const { structure, selectedNodeId, enableAutoAssembly = true } = options;

  const [buffer, setBuffer] = useState<ContextBuffer>({
    entries: [],
    totalTokens: 0,
    maxTokens: MAX_TOKENS,
    lastAssembled: new Date(),
    tokensByTier: { local: 0, sibling: 0, document: 0 },
  });
  
  const [isAssembling, setIsAssembling] = useState(false);

  // Find node by ID
  const findNode = useCallback((nodes: HDSINode[], id: string): HDSINode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNode(node.children, id);
      if (found) return found;
    }
    return null;
  }, []);

  // Find siblings of a node
  const findSiblings = useCallback((nodes: HDSINode[], id: string): HDSINode[] => {
    for (const node of nodes) {
      const siblingIndex = node.children.findIndex(c => c.id === id);
      if (siblingIndex >= 0) {
        return node.children.filter(c => c.id !== id && c.status !== "deleted");
      }
      const found = findSiblings(node.children, id);
      if (found.length > 0) return found;
    }
    // Check top level
    const topIndex = nodes.findIndex(n => n.id === id);
    if (topIndex >= 0) {
      return nodes.filter(n => n.id !== id && n.status !== "deleted");
    }
    return [];
  }, []);

  // Find parent of a node
  const findParent = useCallback((nodes: HDSINode[], id: string): HDSINode | null => {
    for (const node of nodes) {
      if (node.children.some(c => c.id === id)) return node;
      const found = findParent(node.children, id);
      if (found) return found;
    }
    return null;
  }, []);

  // Assemble context for a node
  const assembleContext = useCallback(async (nodeId: string) => {
    setIsAssembling(true);

    try {
      const targetNode = findNode(structure, nodeId);
      const siblings = findSiblings(structure, nodeId);
      const parent = findParent(structure, nodeId);

      const entries: ContextBufferEntry[] = [];
      let totalTokens = 0;

      // Add local context (current node)
      if (targetNode && targetNode.customPrompt) {
        const tokenCount = Math.ceil(targetNode.customPrompt.length / 4);
        entries.push({
          id: crypto.randomUUID(),
          tier: "local",
          sourceNodeId: targetNode.id,
          sourceTitle: targetNode.title,
          content: targetNode.customPrompt,
          tokenCount,
          relevanceScore: 1.0,
          embeddingDrift: 0,
          timestamp: new Date(),
        });
        totalTokens += tokenCount;
      }

      // Add sibling context
      for (const sibling of siblings.slice(0, 3)) {
        if (totalTokens >= MAX_TOKENS) break;
        const content = sibling.generatedContent || sibling.customPrompt || "";
        if (!content) continue;
        const tokenCount = Math.min(Math.ceil(content.length / 4), MAX_TOKENS - totalTokens);
        entries.push({
          id: crypto.randomUUID(),
          tier: "sibling",
          sourceNodeId: sibling.id,
          sourceTitle: sibling.title,
          content: content.slice(0, tokenCount * 4),
          tokenCount,
          relevanceScore: 0.8,
          embeddingDrift: 0, // Will be calculated from actual embeddings
          timestamp: new Date(),
        });
        totalTokens += tokenCount;
      }

      // Add document context (parent)
      if (parent && totalTokens < MAX_TOKENS) {
        const content = parent.generatedContent || parent.customPrompt || parent.title;
        const tokenCount = Math.min(Math.ceil(content.length / 4), MAX_TOKENS - totalTokens);
        entries.push({
          id: crypto.randomUUID(),
          tier: "document",
          sourceNodeId: parent.id,
          sourceTitle: parent.title,
          content: content.slice(0, tokenCount * 4),
          tokenCount,
          relevanceScore: 0.7,
          embeddingDrift: 0, // Will be calculated from actual embeddings
          timestamp: new Date(),
        });
        totalTokens += tokenCount;
      }

      // Calculate tokens by tier
      const tokensByTier = {
        local: entries.filter(e => e.tier === "local").reduce((sum, e) => sum + e.tokenCount, 0),
        sibling: entries.filter(e => e.tier === "sibling").reduce((sum, e) => sum + e.tokenCount, 0),
        document: entries.filter(e => e.tier === "document").reduce((sum, e) => sum + e.tokenCount, 0),
      };

      setBuffer({
        entries,
        totalTokens,
        maxTokens: MAX_TOKENS,
        lastAssembled: new Date(),
        tokensByTier,
      });
    } catch (error) {
      console.error("Failed to assemble context:", error);
    } finally {
      setIsAssembling(false);
    }
  }, [structure, findNode, findSiblings, findParent]);

  // Refresh context for currently selected node
  const refreshContext = useCallback(async () => {
    if (selectedNodeId) {
      await assembleContext(selectedNodeId);
    }
  }, [selectedNodeId, assembleContext]);

  // Auto-assemble when selection changes
  useEffect(() => {
    if (enableAutoAssembly && selectedNodeId) {
      assembleContext(selectedNodeId);
    }
  }, [selectedNodeId, enableAutoAssembly, assembleContext]);

  return {
    buffer,
    isAssembling,
    assembleContext,
    refreshContext,
  };
}
