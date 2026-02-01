"use client";

/**
 * Graph View System for HDSI Documents
 * 
 * Force-directed graph visualizing document connections:
 * - Bidirectional links between documents
 * - Parent-child hierarchical relationships
 * - Tag-based clustering
 * - Opportunity-based grouping
 * 
 * Features:
 * - Click to navigate to document
 * - Drag to explore/pan
 * - Zoom controls
 * - Filter by connection type
 */

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3";
import type { DocumentMetadata } from "./document-organization";

// ============================================================================
// Types
// ============================================================================

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  type: "document" | "tag" | "opportunity" | "folder" | "project" | "client";
  label: string;
  color: string;
  size: number;
  metadata?: DocumentMetadata;
  // Physics properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "bidirectional" | "parent-child" | "tag" | "opportunity" | "hierarchical" | "reference";
  strength: number;
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphFilters {
  showDocuments: boolean;
  showTags: boolean;
  showOpportunities: boolean;
  showFolders: boolean;
  showBidirectionalLinks: boolean;
  showParentChildLinks: boolean;
  showTagLinks: boolean;
  minLinkStrength: number;
  searchQuery?: string;
}

export interface GraphViewState {
  zoom: number;
  centerX: number;
  centerY: number;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
}

// ============================================================================
// Color Scheme
// ============================================================================

const NODE_COLORS: Record<string, string> = {
  document: "#3b82f6",      // blue-500
  document_active: "#2563eb", // blue-600
  document_archived: "#9ca3af", // gray-400
  tag: "#f59e0b",           // amber-500
  opportunity: "#dc2626",   // red-600
  folder: "#10b981",        // emerald-500
  project: "#8b5cf6",       // violet-500
  client: "#06b6d4",        // cyan-500
};

const LINK_COLORS: Record<string, string> = {
  bidirectional: "#3b82f6",  // blue
  parent_child: "#94a3b8",   // slate
  tag: "#f59e0b",            // amber
  opportunity: "#dc2626",    // red
  hierarchical: "#64748b",   // slate-dark
  reference: "#8b5cf6",      // violet
};

// ============================================================================
// Graph Building Functions
// ============================================================================

export function buildDocumentGraph(
  documents: DocumentMetadata[],
  options?: {
    includeTags?: boolean;
    includeOpportunities?: boolean;
    includeFolders?: boolean;
    includeProjects?: boolean;
    includeClients?: boolean;
  }
): GraphData {
  const {
    includeTags = true,
    includeOpportunities = true,
    includeFolders = true,
    includeProjects = false,
    includeClients = false,
  } = options || {};

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeIds = new Set<string>();

  // Helper to add node
  const addNode = (node: GraphNode) => {
    if (!nodeIds.has(node.id)) {
      nodes.push(node);
      nodeIds.add(node.id);
    }
  };

  // Helper to add link
  const addLink = (link: GraphLink) => {
    // Avoid duplicate links
    const exists = links.some(
      l =>
        (l.source === link.source && l.target === link.target) ||
        (l.source === link.target && l.target === link.source)
    );
    if (!exists) {
      links.push(link);
    }
  };

  // Add document nodes
  documents.forEach(doc => {
    addNode({
      id: doc.id,
      type: "document",
      label: doc.title,
      color: doc.isArchived
        ? NODE_COLORS.document_archived
        : doc.status === "submitted"
        ? NODE_COLORS.document_active
        : NODE_COLORS.document,
      size: Math.max(10, Math.min(30, 10 + doc.nodeCount / 2)),
      metadata: doc,
    });
  });

  // Add tag nodes and links
  if (includeTags) {
    const allTags = new Map<string, number>();
    documents.forEach(doc => {
      doc.tags.forEach(tag => {
        allTags.set(tag, (allTags.get(tag) || 0) + 1);
      });
    });

    allTags.forEach((count, tag) => {
      if (count > 1) {
        // Only add tags with multiple documents
        const tagId = `tag:${tag}`;
        addNode({
          id: tagId,
          type: "tag",
          label: tag,
          color: NODE_COLORS.tag,
          size: 8 + count * 2,
        });

        // Connect to documents
        documents.forEach(doc => {
          if (doc.tags.includes(tag)) {
            addLink({
              source: doc.id,
              target: tagId,
              type: "tag",
              strength: 0.5,
              color: LINK_COLORS.tag,
            });
          }
        });
      }
    });
  }

  // Add opportunity nodes and links
  if (includeOpportunities) {
    const allOpportunities = new Map<string, { name: string; count: number }>();
    documents.forEach(doc => {
      if (doc.opportunityId && doc.opportunityName) {
        const existing = allOpportunities.get(doc.opportunityId);
        if (existing) {
          existing.count++;
        } else {
          allOpportunities.set(doc.opportunityId, {
            name: doc.opportunityName,
            count: 1,
          });
        }
      }
    });

    allOpportunities.forEach((data, oppId) => {
      const oppNodeId = `opp:${oppId}`;
      addNode({
        id: oppNodeId,
        type: "opportunity",
        label: data.name,
        color: NODE_COLORS.opportunity,
        size: 12 + data.count * 3,
      });

      // Connect to documents
      documents.forEach(doc => {
        if (doc.opportunityId === oppId) {
          addLink({
            source: doc.id,
            target: oppNodeId,
            type: "opportunity",
            strength: 0.8,
            color: LINK_COLORS.opportunity,
          });
        }
      });
    });
  }

  // Add folder nodes and links
  if (includeFolders) {
    const allFolders = new Map<string, { path: string[]; count: number }>();
    documents.forEach(doc => {
      if (doc.folderId && doc.folderPath) {
        const key = doc.folderPath.join("/");
        const existing = allFolders.get(key);
        if (existing) {
          existing.count++;
        } else {
          allFolders.set(key, { path: doc.folderPath, count: 1 });
        }
      }
    });

    allFolders.forEach((data, key) => {
      const folderId = `folder:${key}`;
      addNode({
        id: folderId,
        type: "folder",
        label: data.path[data.path.length - 1],
        color: NODE_COLORS.folder,
        size: 10 + data.count * 2,
      });

      // Connect to documents
      documents.forEach(doc => {
        if (doc.folderPath?.join("/") === key) {
          addLink({
            source: doc.id,
            target: folderId,
            type: "hierarchical",
            strength: 0.6,
            color: LINK_COLORS.hierarchical,
          });
        }
      });
    });
  }

  // Add bidirectional link connections (parsed from content)
  documents.forEach(doc => {
    const bidirectionalLinks = extractBidirectionalLinks(doc);
    bidirectionalLinks.forEach(link => {
      const targetDoc = documents.find(d => d.title.toLowerCase() === link.toLowerCase() || d.id === link);
      if (targetDoc) {
        addLink({
          source: doc.id,
          target: targetDoc.id,
          type: "bidirectional",
          strength: 0.9,
          color: LINK_COLORS.bidirectional,
        });
      }
    });
  });

  return { nodes, links };
}

// Extract [[Link]] references from document content (placeholder)
function extractBidirectionalLinks(doc: DocumentMetadata): string[] {
  // This would parse the actual document content for [[Link]] syntax
  // For now, return empty - will be implemented with actual content parsing
  return [];
}

// ============================================================================
// Physics Configuration
// ============================================================================

export const DEFAULT_GRAPH_PHYSICS = {
  // Forces
  chargeStrength: -300,
  chargeDistanceMin: 1,
  chargeDistanceMax: 500,
  
  // Link forces
  linkDistance: 100,
  linkStrength: 0.5,
  
  // Center forces
  centerStrength: 0.05,
  
  // Collision
  collisionRadius: 20,
  collisionStrength: 0.7,
  
  // Simulation
  alpha: 1,
  alphaDecay: 0.02,
  alphaMin: 0.001,
  velocityDecay: 0.4,
  
  // Zoom
  minZoom: 0.1,
  maxZoom: 4,
  initialZoom: 1,
};

// ============================================================================
// React Hook
// ============================================================================

export function useGraphView(
  documents: DocumentMetadata[],
  options?: Parameters<typeof buildDocumentGraph>[1]
) {
  const [filters, setFilters] = useState<GraphFilters>({
    showDocuments: true,
    showTags: true,
    showOpportunities: true,
    showFolders: true,
    showBidirectionalLinks: true,
    showParentChildLinks: true,
    showTagLinks: true,
    minLinkStrength: 0,
  });

  const [viewState, setViewState] = useState<GraphViewState>({
    zoom: 1,
    centerX: 0,
    centerY: 0,
    selectedNodeId: null,
    hoveredNodeId: null,
  });

  // Build graph data
  const graphData = useMemo(() => {
    return buildDocumentGraph(documents, options);
  }, [documents, options]);

  // Filtered graph data
  const filteredGraphData = useMemo(() => {
    let nodes = graphData.nodes;
    let links = graphData.links;

    // Filter nodes by type
    nodes = nodes.filter(node => {
      switch (node.type) {
        case "document":
          return filters.showDocuments;
        case "tag":
          return filters.showTags;
        case "opportunity":
          return filters.showOpportunities;
        case "folder":
          return filters.showFolders;
        default:
          return true;
      }
    });

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchingNodeIds = new Set(
        nodes.filter(n => n.label.toLowerCase().includes(query)).map(n => n.id)
      );
      
      // Include nodes connected to matching nodes
      links.forEach(link => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id;
        const targetId = typeof link.target === "string" ? link.target : link.target.id;
        if (matchingNodeIds.has(sourceId)) matchingNodeIds.add(targetId);
        if (matchingNodeIds.has(targetId)) matchingNodeIds.add(sourceId);
      });
      
      nodes = nodes.filter(n => matchingNodeIds.has(n.id));
    }

    const nodeIds = new Set(nodes.map(n => n.id));

    // Filter links
    links = links.filter(link => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      // Both nodes must exist
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return false;

      // Filter by link type
      switch (link.type) {
        case "bidirectional":
          return filters.showBidirectionalLinks;
        case "parent-child":
        case "hierarchical":
          return filters.showParentChildLinks;
        case "tag":
          return filters.showTagLinks;
        default:
          return true;
      }
    });

    // Filter by minimum strength
    links = links.filter(link => link.strength >= filters.minLinkStrength);

    return { nodes, links };
  }, [graphData, filters]);

  // Actions
  const selectNode = useCallback((nodeId: string | null) => {
    setViewState(prev => ({ ...prev, selectedNodeId: nodeId }));
  }, []);

  const hoverNode = useCallback((nodeId: string | null) => {
    setViewState(prev => ({ ...prev, hoveredNodeId: nodeId }));
  }, []);

  const zoomTo = useCallback((zoom: number, centerX?: number, centerY?: number) => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(4, zoom)),
      ...(centerX !== undefined && { centerX }),
      ...(centerY !== undefined && { centerY }),
    }));
  }, []);

  const resetView = useCallback(() => {
    setViewState({
      zoom: 1,
      centerX: 0,
      centerY: 0,
      selectedNodeId: null,
      hoveredNodeId: null,
    });
  }, []);

  const focusOnNode = useCallback((nodeId: string, nodes: GraphNode[]) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.x !== undefined && node.y !== undefined) {
      setViewState(prev => ({
        ...prev,
        centerX: node.x!,
        centerY: node.y!,
        zoom: 1.5,
        selectedNodeId: nodeId,
      }));
    }
  }, []);

  return {
    graphData,
    filteredGraphData,
    filters,
    setFilters,
    viewState,
    selectNode,
    hoverNode,
    zoomTo,
    resetView,
    focusOnNode,
    nodeCount: filteredGraphData.nodes.length,
    linkCount: filteredGraphData.links.length,
  };
}

// ============================================================================
// Navigation Helper
// ============================================================================

export function getNodeUrl(node: GraphNode): string | null {
  switch (node.type) {
    case "document":
      return `/hdsi?id=${node.id}`;
    case "opportunity":
      return `/opportunities/${node.id.replace("opp:", "")}`;
    case "folder":
      return `/documents?folder=${encodeURIComponent(node.id.replace("folder:", ""))}`;
    default:
      return null;
  }
}

export function getConnectedNodes(
  nodeId: string,
  links: GraphLink[],
  nodes: GraphNode[]
): GraphNode[] {
  const connectedIds = new Set<string>();
  
  links.forEach(link => {
    const sourceId = typeof link.source === "string" ? link.source : link.source.id;
    const targetId = typeof link.target === "string" ? link.target : link.target.id;
    
    if (sourceId === nodeId) connectedIds.add(targetId);
    if (targetId === nodeId) connectedIds.add(sourceId);
  });
  
  return nodes.filter(n => connectedIds.has(n.id));
}

export function getNodeStats(node: GraphNode, links: GraphLink[]) {
  const connections = links.filter(link => {
    const sourceId = typeof link.source === "string" ? link.source : link.source.id;
    const targetId = typeof link.target === "string" ? link.target : link.target.id;
    return sourceId === node.id || targetId === node.id;
  });

  const byType = connections.reduce((acc, link) => {
    acc[link.type] = (acc[link.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalConnections: connections.length,
    byType,
  };
}
