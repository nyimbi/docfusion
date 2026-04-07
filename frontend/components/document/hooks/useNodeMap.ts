"use client";

/**
 * useNodeMap Hook
 * 
 * Provides O(1) node lookups by maintaining a flattened Map of the tree structure.
 * This avoids expensive recursive traversal on every render.
 */

import { useMemo, useCallback } from "react";
import type { HDSINode } from "@/lib/hdsi/types";

export interface NodeMapResult {
  /** Map of node ID to node for O(1) lookup */
  map: Map<string, HDSINode>;
  /** Flat array of all nodes in pre-order */
  flatList: HDSINode[];
  /** Find a node by ID (O(1)) */
  get: (id: string) => HDSINode | undefined;
  /** Get parent of a node */
  getParent: (id: string) => HDSINode | null;
  /** Get siblings of a node */
  getSiblings: (id: string) => HDSINode[];
  /** Get children of a node */
  getChildren: (id: string) => HDSINode[];
  /** Get depth of a node */
  getDepth: (id: string) => number;
  /** Check if node exists */
  has: (id: string) => boolean;
  /** Total node count */
  count: number;
}

export function useNodeMap(structure: HDSINode[]): NodeMapResult {
  return useMemo(() => {
    const map = new Map<string, HDSINode>();
    const flatList: HDSINode[] = [];
    const parentMap = new Map<string, string>(); // childId -> parentId

    function walk(nodes: HDSINode[], parentId?: string) {
      for (const node of nodes) {
        map.set(node.id, node);
        flatList.push(node);
        
        if (parentId) {
          parentMap.set(node.id, parentId);
        }

        if (node.children.length > 0) {
          walk(node.children, node.id);
        }
      }
    }

    walk(structure);

    const get = (id: string): HDSINode | undefined => map.get(id);

    const getParent = (id: string): HDSINode | null => {
      const parentId = parentMap.get(id);
      return parentId ? map.get(parentId) ?? null : null;
    };

    const getSiblings = (id: string): HDSINode[] => {
      const parentId = parentMap.get(id);
      if (!parentId) {
        // Top level - return all root nodes except self
        return structure.filter(n => n.id !== id);
      }
      const parent = map.get(parentId);
      return parent?.children.filter(c => c.id !== id) ?? [];
    };

    const getChildren = (id: string): HDSINode[] => {
      return map.get(id)?.children ?? [];
    };

    const getDepth = (id: string): number => {
      let depth = 0;
      let currentId = id;
      while (parentMap.has(currentId)) {
        depth++;
        currentId = parentMap.get(currentId)!;
      }
      return depth;
    };

    const has = (id: string): boolean => map.has(id);

    return {
      map,
      flatList,
      get,
      getParent,
      getSiblings,
      getChildren,
      getDepth,
      has,
      count: flatList.length,
    };
  }, [structure]);
}

/**
 * Hook for finding nodes to generate (filtering out already generated and deleted)
 */
export function useNodesToGenerate(structure: HDSINode[]): HDSINode[] {
  return useMemo(() => {
    const result: HDSINode[] = [];

    function collect(nodes: HDSINode[]) {
      for (const node of nodes) {
        if (node.status !== "deleted" && node.status !== "generated") {
          result.push(node);
        }
        collect(node.children);
      }
    }

    collect(structure);
    return result;
  }, [structure]);
}

/**
 * Hook for collecting node statistics
 */
export function useNodeStats(structure: HDSINode[]) {
  return useMemo(() => {
    let totalNodes = 0;
    let generatedNodes = 0;
    let outlineNodes = 0;
    let generatingNodes = 0;
    let errorNodes = 0;
    let debtNodes = 0;
    let deletedNodes = 0;

    function walk(nodes: HDSINode[]) {
      for (const node of nodes) {
        totalNodes++;
        
        switch (node.status) {
          case "generated":
            generatedNodes++;
            break;
          case "outline":
            outlineNodes++;
            break;
          case "generating":
            generatingNodes++;
            break;
          case "error":
            errorNodes++;
            break;
          case "debt":
            debtNodes++;
            break;
          case "deleted":
            deletedNodes++;
            break;
        }

        walk(node.children);
      }
    }

    walk(structure);

    return {
      totalNodes,
      generatedNodes,
      outlineNodes,
      generatingNodes,
      errorNodes,
      debtNodes,
      deletedNodes,
      completionPercent: totalNodes > 0 ? Math.round((generatedNodes / totalNodes) * 100) : 0,
    };
  }, [structure]);
}
