"use client";

/**
 * Graph View Component
 * 
 * Interactive force-directed graph visualizing document connections.
 * 
 * Features:
 * - Force-directed layout with D3 physics
 * - Click to navigate to documents
 * - Drag to pan, scroll to zoom
 * - Node filtering by type
 * - Link filtering by connection type
 * - Search to highlight nodes
 * - Node selection with details panel
 */

import * as React from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// Graph system
import {
  useGraphView,
  DEFAULT_GRAPH_PHYSICS,
  getNodeUrl,
  getConnectedNodes,
  getNodeStats,
  type GraphNode,
  type GraphLink,
  type GraphFilters,
} from "@/lib/hdsi/graph-view";
import type { DocumentMetadata } from "@/lib/hdsi/document-organization";

// Icons
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  Search,
  X,
  FileText,
  Tag,
  Target,
  Folder,
  GitBranch,
  Filter,
  RefreshCw,
  Focus,
  MousePointer2,
  ExternalLink,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface GraphViewProps {
  documents: DocumentMetadata[];
  className?: string;
  onNodeClick?: (node: GraphNode) => void;
  initialNodeId?: string;  // Focus on this node initially
}

// ============================================================================
// Main Component
// ============================================================================

export function GraphView(props: GraphViewProps) {
  const { documents, className, onNodeClick, initialNodeId } = props;
  const router = useRouter();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const simulationRef = React.useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  
  const {
    filteredGraphData,
    filters,
    setFilters,
    viewState,
    selectNode,
    hoverNode,
    zoomTo,
    resetView,
    focusOnNode,
    nodeCount,
    linkCount,
  } = useGraphView(documents);

  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [showFilters, setShowFilters] = React.useState(false);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });

  // Initialize dimensions
  React.useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    }
    
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize D3 simulation
  React.useEffect(() => {
    if (!svgRef.current || filteredGraphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([DEFAULT_GRAPH_PHYSICS.minZoom, DEFAULT_GRAPH_PHYSICS.maxZoom])
      .on("zoom", (event) => {
        const transform = event.transform;
        zoomTo(transform.k, transform.x, transform.y);
        g.attr("transform", transform.toString());
      });

    svg.call(zoom);

    // Create main group
    const g = svg.append("g");

    // Initialize zoom transform
    const initialTransform = d3.zoomIdentity
      .translate(viewState.centerX || centerX, viewState.centerY || centerY)
      .scale(viewState.zoom);
    svg.call(zoom.transform, initialTransform);

    // Create simulation
    const simulation = d3.forceSimulation<GraphNode>(filteredGraphData.nodes)
      .force(
        "link",
        d3.forceLink<GraphNode, GraphLink>(filteredGraphData.links)
          .id(d => d.id)
          .distance(DEFAULT_GRAPH_PHYSICS.linkDistance)
          .strength(d => d.strength * DEFAULT_GRAPH_PHYSICS.linkStrength)
      )
      .force(
        "charge",
        d3.forceManyBody()
          .strength(DEFAULT_GRAPH_PHYSICS.chargeStrength)
          .distanceMin(DEFAULT_GRAPH_PHYSICS.chargeDistanceMin)
          .distanceMax(DEFAULT_GRAPH_PHYSICS.chargeDistanceMax)
      )
      .force(
        "center",
        d3.forceCenter(centerX, centerY).strength(DEFAULT_GRAPH_PHYSICS.centerStrength)
      )
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius(d => (d.size || 10) + DEFAULT_GRAPH_PHYSICS.collisionRadius)
      )
      .alpha(DEFAULT_GRAPH_PHYSICS.alpha)
      .alphaDecay(DEFAULT_GRAPH_PHYSICS.alphaDecay)
      .alphaMin(DEFAULT_GRAPH_PHYSICS.alphaMin)
      .velocityDecay(DEFAULT_GRAPH_PHYSICS.velocityDecay);

    simulationRef.current = simulation;

    // Draw links
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(filteredGraphData.links)
      .enter()
      .append("line")
      .attr("stroke", d => d.color || "#94a3b8")
      .attr("stroke-width", d => Math.sqrt(d.strength) * 2 + 0.5)
      .attr("stroke-opacity", 0.6)
      .attr("stroke-dasharray", d => d.type === "bidirectional" ? "5,5" : "none");

    // Draw nodes
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(filteredGraphData.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", d => getNodeUrl(d) ? "pointer" : "default")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node circles
    node
      .append("circle")
      .attr("r", d => d.size || 10)
      .attr("fill", d => d.color)
      .attr("stroke", d => viewState.selectedNodeId === d.id ? "#fff" : "transparent")
      .attr("stroke-width", d => viewState.selectedNodeId === d.id ? 3 : 0)
      .attr("class", "transition-all duration-200");

    // Node labels
    node
      .append("text")
      .attr("dx", d => (d.size || 10) + 5)
      .attr("dy", ".35em")
      .text(d => d.label)
      .attr("fill", "currentColor")
      .attr("font-size", "12px")
      .attr("font-weight", d => d.type === "document" ? "500" : "400")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.1)");

    // Node icons (emoji or simple indicator)
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .style("pointer-events", "none")
      .style("font-size", d => `${(d.size || 10) * 0.6}px`)
      .text(d => {
        switch (d.type) {
          case "document": return "📄";
          case "tag": return "🏷️";
          case "opportunity": return "🎯";
          case "folder": return "📁";
          case "project": return "📊";
          case "client": return "🏢";
          default: return "●";
        }
      });

    // Node interactions
    node
      .on("click", (event, d) => {
        event.stopPropagation();
        selectNode(d.id);
        
        if (onNodeClick) {
          onNodeClick(d);
        } else {
          const url = getNodeUrl(d);
          if (url) {
            router.push(url);
          }
        }
      })
      .on("mouseover", (event, d) => {
        hoverNode(d.id);
      })
      .on("mouseout", () => {
        hoverNode(null);
      });

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Focus on initial node
    if (initialNodeId) {
      setTimeout(() => {
        focusOnNode(initialNodeId, filteredGraphData.nodes);
      }, 500);
    }

    return () => {
      simulation.stop();
    };
  }, [filteredGraphData, dimensions, viewState.zoom, viewState.centerX, viewState.centerY, viewState.selectedNodeId, initialNodeId, zoomTo, selectNode, onNodeClick, router, hoverNode, focusOnNode]);

  // Get selected node details
  const selectedNode = React.useMemo(() => {
    if (!viewState.selectedNodeId) return null;
    return filteredGraphData.nodes.find(n => n.id === viewState.selectedNodeId) || null;
  }, [viewState.selectedNodeId, filteredGraphData]);

  // Get connected nodes for selected
  const connectedNodes = React.useMemo(() => {
    if (!selectedNode) return [];
    return getConnectedNodes(selectedNode.id, filteredGraphData.links, filteredGraphData.nodes);
  }, [selectedNode, filteredGraphData]);

  // Node stats
  const nodeStats = React.useMemo(() => {
    if (!selectedNode) return null;
    return getNodeStats(selectedNode, filteredGraphData.links);
  }, [selectedNode, filteredGraphData]);

  // Handle background click to deselect
  const handleBackgroundClick = () => {
    selectNode(null);
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setDragStart({ x: e.clientX, y: e.clientY });
    // Apply pan to transform
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <TooltipProvider>
      <div className={cn("flex h-full bg-background", className)}>
        {/* Main Graph Area */}
        <div 
          ref={containerRef}
          role="button"
          tabIndex={0}
          aria-label="Interactive document graph"
          className="flex-1 relative overflow-hidden"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              selectNode(null);
            } else if (event.key === "0") {
              event.preventDefault();
              resetView();
            } else if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              zoomTo(Math.min(viewState.zoom * 1.2, DEFAULT_GRAPH_PHYSICS.maxZoom), viewState.centerX, viewState.centerY);
            } else if (event.key === "-") {
              event.preventDefault();
              zoomTo(Math.max(viewState.zoom / 1.2, DEFAULT_GRAPH_PHYSICS.minZoom), viewState.centerX, viewState.centerY);
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            className="w-full h-full"
            onClick={handleBackgroundClick}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          />

          {/* Overlay Controls */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {/* Search */}
            <div className="bg-background/90 backdrop-blur shadow-sm border rounded-lg p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Find nodes..."
                  className="pl-8 w-48"
                  value={filters.searchQuery || ""}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="bg-background/90 backdrop-blur shadow-sm border rounded-lg px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {nodeCount} nodes • {linkCount} connections
              </div>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => zoomTo(viewState.zoom * 1.2)}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => zoomTo(viewState.zoom / 1.2)}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={resetView}
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset View</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showFilters ? "primary" : "secondary"}
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle Filters</TooltipContent>
            </Tooltip>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur shadow-sm border rounded-lg p-3">
            <h4 className="text-xs font-semibold mb-2">Node Types</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Document</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Tag</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                <span>Opportunity</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Folder</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="w-64 border-l bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filters</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            {/* Node Types */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Show Nodes</h4>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showDocuments}
                  onChange={(e) => setFilters(prev => ({ ...prev, showDocuments: e.target.checked }))}
                />
                Documents
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showTags}
                  onChange={(e) => setFilters(prev => ({ ...prev, showTags: e.target.checked }))}
                />
                Tags
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showOpportunities}
                  onChange={(e) => setFilters(prev => ({ ...prev, showOpportunities: e.target.checked }))}
                />
                Opportunities
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showFolders}
                  onChange={(e) => setFilters(prev => ({ ...prev, showFolders: e.target.checked }))}
                />
                Folders
              </label>
            </div>

            <Separator />

            {/* Link Types */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Show Connections</h4>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showBidirectionalLinks}
                  onChange={(e) => setFilters(prev => ({ ...prev, showBidirectionalLinks: e.target.checked }))}
                />
                Bidirectional Links
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showTagLinks}
                  onChange={(e) => setFilters(prev => ({ ...prev, showTagLinks: e.target.checked }))}
                />
                Tag Connections
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showParentChildLinks}
                  onChange={(e) => setFilters(prev => ({ ...prev, showParentChildLinks: e.target.checked }))}
                />
                Hierarchical Links
              </label>
            </div>

            <Separator />

            {/* Min Strength */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Min. Link Strength</h4>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={filters.minLinkStrength}
                onChange={(e) => setFilters(prev => ({ ...prev, minLinkStrength: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center">
                {filters.minLinkStrength.toFixed(1)}
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={resetView}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset All
            </Button>
          </div>
        )}

        {/* Selected Node Details */}
        {selectedNode && (
          <div className="w-80 border-l bg-background">
            <Card className="border-0 rounded-none h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge 
                      variant="outline" 
                      className="mb-2 capitalize"
                      style={{ borderColor: selectedNode.color, color: selectedNode.color }}
                    >
                      {selectedNode.type}
                    </Badge>
                    <CardTitle className="text-lg">{selectedNode.label}</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => selectNode(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats */}
                {nodeStats && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <div className="text-2xl font-semibold">{nodeStats.totalConnections}</div>
                      <div className="text-xs text-muted-foreground">Connections</div>
                    </div>
                    {Object.entries(nodeStats.byType).slice(0, 1).map(([type, count]) => (
                      <div key={type} className="bg-muted rounded-lg p-2 text-center">
                        <div className="text-2xl font-semibold">{count}</div>
                        <div className="text-xs text-muted-foreground capitalize">{type.replace("-", " ")}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Connected Nodes */}
                {connectedNodes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Connected to</h4>
                    <ScrollArea className="h-48">
                      <div className="space-y-1">
                        {connectedNodes.map(node => (
                          <button
                            key={node.id}
                            onClick={() => selectNode(node.id)}
                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left"
                          >
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: node.color }}
                            />
                            <span className="text-sm truncate">{node.label}</span>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {selectedNode.type === "document" && (
                    <Button 
                      className="w-full"
                      onClick={() => {
                        const url = getNodeUrl(selectedNode);
                        if (url) router.push(url);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Document
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => focusOnNode(selectedNode.id, filteredGraphData.nodes)}
                  >
                    <Focus className="h-4 w-4 mr-2" />
                    Focus on Node
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
