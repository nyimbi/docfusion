"use client";

/**
 * HDSI Enhanced - Hierarchical Document Synthesis Interface
 *
 * Features:
 * - Drag-and-drop reordering of sections
 * - Create subsections (nested structure)
 * - Working Generate Content with visual feedback
 * - Expand/collapse tree nodes
 * - Indent/outdent for hierarchy
 * - Per-section AI generation
 * - Delete confirmation with soft/hard delete
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { HDSINodeEditor } from "./HDSINodeEditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Indent,
  Outdent,
  Wand2,
  GripVertical,
  Loader2,
  CheckCircle,
  AlertCircle,
  Archive,
  XCircle,
  Sparkles,
} from "lucide-react";

import type { HDSINode } from "@/lib/hdsi/types";
import { NodeGlyph } from "./NodeGlyph";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

// Extended interface for component-local use

interface HDSIEnhancedProps {
  initialStructure?: HDSINode[];
  documentId?: string;
  documentTitle?: string;
  /** Full document context for better AI generation */
  documentContext?: {
    description?: string;
    audience?: string;
    purpose?: string;
    themes?: string[];
  };
  onStructureChange?: (structure: HDSINode[]) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  onGenerateNode?: (nodeId: string, node: HDSINode) => Promise<string>;
  onGenerateAll?: () => Promise<void>;
  isGenerating?: boolean;
}

/** Delete confirmation state */
interface DeleteConfirmation {
  nodeId: string;
  nodeTitle: string;
  hasChildren: boolean;
}

// Initialize structure with proper depth
function initializeStructure(input?: any[]): HDSINode[] {
  if (!input || input.length === 0) return [];
  
  const setDepth = (nodes: HDSINode[], depth: number = 0): HDSINode[] => {
    return nodes.map((node, index) => ({
      id: node.id || `node-${index}`,
      type: node.type || "section",
      title: node.title || "Untitled",
      order: node.order || index + 1,
      expanded: node.expanded ?? true,
      status: node.status || "outline",
      tokenBudget: node.tokenBudget || 500,
      customPrompt: node.customPrompt || "",
      densityTarget: node.densityTarget || 2.5,
      coherenceScore: node.coherenceScore || 1.0,
      depth,
      children: node.children ? setDepth(node.children, depth + 1) : [],
      generatedContent: node.generatedContent,
    }));
  };
  
  return setDepth(input as HDSINode[]);
}

export function HDSIEnhanced({
  initialStructure,
  documentId = "doc-1",
  documentTitle = "Untitled Document",
  documentContext,
  onStructureChange,
  onNodeSelect,
  onGenerateNode,
  onGenerateAll,
  isGenerating: externalGenerating,
}: HDSIEnhancedProps) {
  const [structure, setStructure] = React.useState<HDSINode[]>(() =>
    initializeStructure(initialStructure)
  );
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [generatingNodes, setGeneratingNodes] = React.useState<Set<string>>(new Set());
  const [draggedNodeId, setDraggedNodeId] = React.useState<string | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = React.useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState<DeleteConfirmation | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);

  // Store callbacks in refs to avoid infinite loops from unstable references
  const onStructureChangeRef = React.useRef(onStructureChange);
  const onNodeSelectRef = React.useRef(onNodeSelect);

  React.useEffect(() => {
    onStructureChangeRef.current = onStructureChange;
  }, [onStructureChange]);

  React.useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  // Notify parent of changes (using refs to avoid dependency issues)
  React.useEffect(() => {
    onStructureChangeRef.current?.(structure);
  }, [structure]);

  // Notify parent of selection
  React.useEffect(() => {
    onNodeSelectRef.current?.(selectedNodeId);
  }, [selectedNodeId]);

  // Track if we've initialized to prevent infinite loops
  const hasInitializedRef = React.useRef(false);
  const initialStructureIdRef = React.useRef<string | null>(null);

  // Update structure when props change (only if it's truly a new structure)
  React.useEffect(() => {
    if (!initialStructure || initialStructure.length === 0) return;

    // Generate a simple ID based on structure content to detect actual changes
    const structureId = initialStructure.map(n => n.id).join(",");

    // Only update if this is genuinely new initial data
    if (!hasInitializedRef.current || structureId !== initialStructureIdRef.current) {
      hasInitializedRef.current = true;
      initialStructureIdRef.current = structureId;
      setStructure(initializeStructure(initialStructure));
    }
  }, [initialStructure]);

  // Find node by ID (recursive)
  const findNode = (nodes: HDSINode[], id: string): HDSINode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNode(node.children, id);
      if (found) return found;
    }
    return null;
  };

  // Find parent of node
  const findParent = (nodes: HDSINode[], childId: string): HDSINode | null => {
    for (const node of nodes) {
      if (node.children.some(c => c.id === childId)) return node;
      const found = findParent(node.children, childId);
      if (found) return found;
    }
    return null;
  };

  // Update node by ID (recursive)
  const updateNode = (nodes: HDSINode[], id: string, updates: Partial<HDSINode>): HDSINode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, ...updates };
      }
      if (node.children.length > 0) {
        return { ...node, children: updateNode(node.children, id, updates) };
      }
      return node;
    });
  };

  // Add new node
  const addNode = (parentId?: string) => {
    const newNode: HDSINode = {
      id: crypto.randomUUID(),
      type: "section",
      title: "New Section",
      order: structure.length + 1,
      expanded: true,
      status: "outline",
      tokenBudget: 500,
      customPrompt: "",
      densityTarget: 2.5,
      coherenceScore: 1.0,
      children: [],
      depth: parentId ? (findNode(structure, parentId)?.depth ?? 0) + 1 : 0,
    };

    if (parentId) {
      setStructure(prev => updateNode(prev, parentId, {
        children: [...(findNode(prev, parentId)?.children || []), newNode],
        expanded: true
      }));
    } else {
      setStructure(prev => [...prev, newNode]);
    }
    setSelectedNodeId(newNode.id);
    toast.success("Section added");
  };

  // Request delete confirmation
  const requestDelete = (id: string) => {
    const node = findNode(structure, id);
    if (node) {
      setDeleteConfirmation({
        nodeId: id,
        nodeTitle: node.title,
        hasChildren: node.children.length > 0,
      });
    }
  };

  // Soft delete - just marks as deleted but keeps in structure (for undo)
  const softDeleteNode = (id: string) => {
    const markDeleted = (nodes: HDSINode[]): HDSINode[] => {
      return nodes.map(n => {
        if (n.id === id) {
          return { ...n, status: "deleted" as const, deletedAt: new Date().toISOString() };
        }
        return { ...n, children: markDeleted(n.children) };
      });
    };

    setStructure(prev => markDeleted(prev));
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
    setDeleteConfirmation(null);
    toast.success("Section archived (can be restored)", {
      action: {
        label: "Undo",
        onClick: () => restoreNode(id),
      },
    });
  };

  // Hard delete - permanently removes from structure
  const hardDeleteNode = (id: string) => {
    const removeFromArray = (nodes: HDSINode[]): HDSINode[] => {
      return nodes.filter(n => n.id !== id).map(n => ({
        ...n,
        children: removeFromArray(n.children),
      }));
    };

    setStructure(prev => removeFromArray(prev));
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
    setDeleteConfirmation(null);
    toast.success("Section permanently deleted");
  };

  // Restore soft-deleted node
  const restoreNode = (id: string) => {
    const restore = (nodes: HDSINode[]): HDSINode[] => {
      return nodes.map(n => {
        if (n.id === id) {
          const { deletedAt, ...rest } = n as HDSINode & { deletedAt?: string };
          return { ...rest, status: "outline" as const };
        }
        return { ...n, children: restore(n.children) };
      });
    };

    setStructure(prev => restore(prev));
    toast.success("Section restored");
  };

  // Generate content for a single node and optionally its offspring
  const handleGenerateNode = async (id: string, includeOffspring: boolean = true) => {
    const node = findNode(structure, id);
    if (!node || !onGenerateNode) return;

    // Collect all nodes to generate (parent first, then children depth-first)
    const collectNodesToGenerate = (n: HDSINode): HDSINode[] => {
      const result: HDSINode[] = [n];
      if (includeOffspring && n.children.length > 0) {
        for (const child of n.children) {
          if (child.status !== "deleted") {
            result.push(...collectNodesToGenerate(child));
          }
        }
      }
      return result;
    };

    const nodesToGenerate = collectNodesToGenerate(node);
    const hasOffspring = nodesToGenerate.length > 1;

    if (hasOffspring) {
      toast.info(`Generating "${node.title}" and ${nodesToGenerate.length - 1} child section(s)...`);
    }

    // Track current structure for sequential updates (avoid stale closure)
    let currentStructure = structure;
    let generatedCount = 0;

    for (const nodeToGen of nodesToGenerate) {
      // Get fresh node reference from current structure
      const freshNode = findNode(currentStructure, nodeToGen.id);
      if (!freshNode) continue;

      setGeneratingNodes(prev => new Set(prev).add(nodeToGen.id));
      try {
        const content = await onGenerateNode(nodeToGen.id, freshNode);
        // Update structure and track current state
        currentStructure = updateNode(currentStructure, nodeToGen.id, {
          generatedContent: content,
          status: "generated",
        });
        setStructure(currentStructure);
        generatedCount++;

        if (hasOffspring) {
          toast.info(`Progress: ${generatedCount}/${nodesToGenerate.length}`, { id: "generate-offspring-progress" });
        }
      } catch (error) {
        toast.error(`Failed to generate "${freshNode.title}": ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setGeneratingNodes(prev => {
          const next = new Set(prev);
          next.delete(nodeToGen.id);
          return next;
        });
      }
    }

    if (hasOffspring) {
      toast.success(`Generated ${generatedCount} section(s) for "${node.title}" and offspring`);
    } else {
      toast.success(`Generated content for "${node.title}"`);
    }
  };

  // Generate all sections sequentially
  const handleGenerateAll = async () => {
    if (!onGenerateNode) {
      toast.error("Generation not available");
      return;
    }

    setIsGeneratingAll(true);

    // Collect all nodes in order (depth-first)
    const collectNodes = (nodes: HDSINode[]): HDSINode[] => {
      const result: HDSINode[] = [];
      for (const node of nodes) {
        // Skip deleted nodes and nodes that already have content
        if (node.status !== "deleted") {
          result.push(node);
          if (node.children.length > 0) {
            result.push(...collectNodes(node.children));
          }
        }
      }
      return result;
    };

    const allNodes = collectNodes(structure);
    const nodesToGenerate = allNodes.filter(n => !n.generatedContent || n.status === "outline");

    if (nodesToGenerate.length === 0) {
      toast.info("All sections already have content");
      setIsGeneratingAll(false);
      return;
    }

    let generated = 0;
    const total = nodesToGenerate.length;

    toast.info(`Generating ${total} sections...`);

    for (const node of nodesToGenerate) {
      setGeneratingNodes(prev => new Set(prev).add(node.id));
      try {
        const content = await onGenerateNode(node.id, node);
        setStructure(prev =>
          updateNode(prev, node.id, {
            generatedContent: content,
            status: "generated",
          })
        );
        generated++;
        toast.info(`Progress: ${generated}/${total} sections`, { id: "generate-progress" });
      } catch (error) {
        console.error(`Failed to generate ${node.title}:`, error);
        // Continue with next section
      } finally {
        setGeneratingNodes(prev => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    }

    setIsGeneratingAll(false);
    toast.success(`Generated ${generated} of ${total} sections`, { id: "generate-progress" });
  };

  // Move node up/down
  const moveNode = (id: string, direction: "up" | "down") => {
    const moveInArray = (nodes: HDSINode[]): HDSINode[] => {
      const index = nodes.findIndex(n => n.id === id);
      if (index === -1) {
        // Check children
        return nodes.map(n => ({
          ...n,
          children: moveInArray(n.children)
        }));
      }
      
      if (direction === "up" && index > 0) {
        const newNodes = [...nodes];
        [newNodes[index - 1], newNodes[index]] = [newNodes[index], newNodes[index - 1]];
        return newNodes;
      } else if (direction === "down" && index < nodes.length - 1) {
        const newNodes = [...nodes];
        [newNodes[index], newNodes[index + 1]] = [newNodes[index + 1], newNodes[index]];
        return newNodes;
      }
      return nodes;
    };

    setStructure(prev => moveInArray(prev));
  };

  // Indent node (make child of previous sibling)
  const indentNode = (id: string) => {
    const doIndent = (nodes: HDSINode[]): HDSINode[] => {
      const index = nodes.findIndex(n => n.id === id);
      if (index === -1) {
        return nodes.map(n => ({
          ...n,
          children: doIndent(n.children)
        }));
      }
      
      if (index === 0) return nodes; // Can't indent first item
      
      const nodeToIndent = nodes[index];
      const newParent = nodes[index - 1];
      
      // Remove from current position and add as child
      const remaining = nodes.filter((_, i) => i !== index);
      
      return remaining.map(n => {
        if (n.id === newParent.id) {
          return {
            ...n,
            children: [...n.children, { ...nodeToIndent, depth: n.depth + 1 }],
            expanded: true
          };
        }
        return n;
      });
    };

    setStructure(prev => doIndent(prev));
    toast.success("Indented");
  };

  // Outdent node (move to parent level)
  const outdentNode = (id: string) => {
    const parent = findParent(structure, id);
    if (!parent) {
      toast.error("Cannot outdent - already at top level");
      return;
    }

    const doOutdent = (nodes: HDSINode[]): HDSINode[] => {
      const result: HDSINode[] = [];
      
      for (const node of nodes) {
        const childIndex = node.children.findIndex(c => c.id === id);
        
        if (childIndex !== -1) {
          // Found it in children
          const nodeToOutdent = node.children[childIndex];
          result.push({
            ...node,
            children: node.children.filter(c => c.id !== id)
          });
          // Add outdented node after parent
          result.push({ ...nodeToOutdent, depth: node.depth });
        } else {
          result.push({
            ...node,
            children: doOutdent(node.children)
          });
        }
      }
      
      return result;
    };

    setStructure(prev => doOutdent(prev));
    toast.success("Outdented");
  };

  // Toggle expand/collapse
  const toggleExpanded = (id: string) => {
    const node = findNode(structure, id);
    if (node) {
      setStructure(prev => updateNode(prev, id, { expanded: !node.expanded }));
    }
  };

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    setDraggedNodeId(nodeId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    if (nodeId !== draggedNodeId) {
      setDragOverNodeId(nodeId);
    }
  };

  const handleDragLeave = () => {
    setDragOverNodeId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedNodeId || draggedNodeId === targetId) {
      setDraggedNodeId(null);
      setDragOverNodeId(null);
      return;
    }

    // Prevent dropping into own children
    const draggedNode = findNode(structure, draggedNodeId);
    const targetNode = findNode(structure, targetId);
    
    if (!draggedNode || !targetNode) {
      setDraggedNodeId(null);
      setDragOverNodeId(null);
      return;
    }

    // Check if target is a descendant of dragged node
    const isDescendant = (parentId: string, childId: string): boolean => {
      const parent = findNode(structure, parentId);
      if (!parent) return false;
      if (parent.children.some(c => c.id === childId)) return true;
      return parent.children.some(c => isDescendant(c.id, childId));
    };

    if (isDescendant(draggedNodeId, targetId)) {
      toast.error("Cannot move a section into its own subsection");
      setDraggedNodeId(null);
      setDragOverNodeId(null);
      return;
    }

    // Move dragged node to be a child of target
    const removeNode = (nodes: HDSINode[]): HDSINode[] => {
      return nodes.filter(n => n.id !== draggedNodeId).map(n => ({
        ...n,
        children: removeNode(n.children)
      }));
    };

    const addAsChild = (nodes: HDSINode[]): HDSINode[] => {
      return nodes.map(n => {
        if (n.id === targetId) {
          return {
            ...n,
            children: [...n.children, { ...draggedNode, depth: n.depth + 1 }],
            expanded: true
          };
        }
        return { ...n, children: addAsChild(n.children) };
      });
    };

    setStructure(prev => {
      const withoutDragged = removeNode(prev);
      return addAsChild(withoutDragged);
    });

    setDraggedNodeId(null);
    setDragOverNodeId(null);
    toast.success("Section moved");
  };

  // Generate content for a node
  const handleGenerate = async (nodeId: string) => {
    if (!onGenerateNode) {
      toast.error("Generate function not configured");
      return;
    }

    const node = findNode(structure, nodeId);
    if (!node) return;

    setGeneratingNodes(prev => new Set(prev).add(nodeId));
    setStructure(prev => updateNode(prev, nodeId, { status: "generating" }));

    try {
      const content = await onGenerateNode(nodeId, node);
      setStructure(prev => updateNode(prev, nodeId, { 
        status: "generated",
        generatedContent: content
      }));
      toast.success(`Generated content for "${node.title}"`);
    } catch (err) {
      setStructure(prev => updateNode(prev, nodeId, { status: "error" }));
      toast.error("Generation failed");
    } finally {
      setGeneratingNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  };

  // Count total nodes
  const countNodes = (nodes: HDSINode[]): number => {
    return nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
  };

  const totalNodes = countNodes(structure);
  const selectedNode = selectedNodeId ? findNode(structure, selectedNodeId) : null;

  if (structure.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">No document structure</p>
          <Button onClick={() => addNode()} className="mt-2" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add First Section
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Document Structure ({totalNodes} sections)
        </span>
        <div className="flex gap-2">
          <Button onClick={() => addNode()} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Section
          </Button>
          {onGenerateNode && (
            <Button
              onClick={handleGenerateAll}
              disabled={isGeneratingAll || externalGenerating}
              size="sm"
              variant="secondary"
            >
              {isGeneratingAll ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Generate All
            </Button>
          )}
        </div>
      </div>

      {/* Content - Resizable Panels */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Tree Pane */}
        <ResizablePanel defaultSize={33} minSize={20} maxSize={50}>
          <div className="h-full overflow-auto p-2 border-r">
            <TreeView
              nodes={structure.filter(n => n.status !== "deleted")}
              selectedId={selectedNodeId}
              onSelect={setSelectedNodeId}
              onToggle={toggleExpanded}
              onDelete={requestDelete}
              onGenerate={onGenerateNode ? handleGenerateNode : undefined}
              onGenerateAll={onGenerateAll}
              onMove={moveNode}
              onIndent={indentNode}
              onOutdent={outdentNode}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              draggedId={draggedNodeId}
              dragOverId={dragOverNodeId}
              generatingIds={generatingNodes}
              isRoot
              contextMenu={contextMenu}
              onContextMenu={setContextMenu}
              onCloseContextMenu={() => setContextMenu(null)}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Properties Pane */}
        <ResizablePanel defaultSize={67} minSize={40}>
          <div className="h-full p-4 overflow-auto">
            {selectedNode ? (
              <HDSINodeEditor
                node={selectedNode}
                documentId={documentId}
                documentTitle={documentTitle}
                onUpdate={(updates) => {
                  setStructure(prev => updateNode(prev, selectedNode.id, updates));
                }}
                onGenerate={onGenerateNode ? () => handleGenerateNode(selectedNode.id) : undefined}
                isGenerating={generatingNodes.has(selectedNode.id)}
                onAddChild={() => addNode(selectedNode.id)}
                onDelete={() => requestDelete(selectedNode.id)}
                onMoveUp={() => moveNode(selectedNode.id, "up")}
                onMoveDown={() => moveNode(selectedNode.id, "down")}
                onIndent={() => indentNode(selectedNode.id)}
                onOutdent={() => outdentNode(selectedNode.id)}
                canOutdent={!!findParent(structure, selectedNode.id)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Select a section to edit
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Section
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmation?.nodeTitle}"?
              {deleteConfirmation?.hasChildren && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  ⚠️ This section has child sections that will also be affected.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Choose how to delete:</p>
            <div className="grid gap-3">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => deleteConfirmation && softDeleteNode(deleteConfirmation.nodeId)}
              >
                <Archive className="h-4 w-4 mr-3 text-amber-500" />
                <div className="text-left">
                  <p className="font-medium">Archive (Soft Delete)</p>
                  <p className="text-xs text-muted-foreground">
                    Hide the section but keep it recoverable
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3 border-destructive/50 hover:bg-destructive/10"
                onClick={() => deleteConfirmation && hardDeleteNode(deleteConfirmation.nodeId)}
              >
                <XCircle className="h-4 w-4 mr-3 text-destructive" />
                <div className="text-left">
                  <p className="font-medium text-destructive">Permanently Delete</p>
                  <p className="text-xs text-muted-foreground">
                    Remove the section completely (cannot be undone)
                  </p>
                </div>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmation(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Tree View Component with Keyboard Navigation and ARIA Support
// ============================================================================

/** Context menu state for right-click actions */
interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  nodeId: string;
  nodeIndex: number;
  nodeDepth: number;
  siblingsCount: number;
  hasChildren: boolean;
}

interface TreeViewProps {
  nodes: HDSINode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onGenerate?: (id: string) => void;
  onGenerateAll?: () => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  draggedId: string | null;
  dragOverId: string | null;
  generatingIds: Set<string>;
  depth?: number;
  /** Flat list of visible node IDs for keyboard navigation */
  flatNodeIds?: string[];
  /** Root element ref for keyboard event handling */
  isRoot?: boolean;
  /** Context menu state (managed at root level) */
  contextMenu?: ContextMenuState | null;
  /** Handler to open context menu */
  onContextMenu?: (state: ContextMenuState) => void;
  /** Handler to close context menu */
  onCloseContextMenu?: () => void;
}

/**
 * Flatten visible nodes for keyboard navigation.
 * Only includes expanded nodes' children.
 */
function flattenVisibleNodes(nodes: HDSINode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.status === "deleted") continue;
    result.push(node.id);
    if (node.expanded && node.children.length > 0) {
      result.push(...flattenVisibleNodes(node.children));
    }
  }
  return result;
}

function TreeView({
  nodes,
  selectedId,
  onSelect,
  onToggle,
  onDelete,
  onGenerate,
  onGenerateAll,
  onMove,
  onIndent,
  onOutdent,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  draggedId,
  dragOverId,
  generatingIds,
  depth = 0,
  flatNodeIds,
  isRoot = false,
  contextMenu,
  onContextMenu,
  onCloseContextMenu,
}: TreeViewProps) {
  const treeRef = React.useRef<HTMLDivElement>(null);

  // Build flat list at root level
  const visibleNodeIds = React.useMemo(() => {
    if (flatNodeIds) return flatNodeIds;
    if (isRoot || depth === 0) return flattenVisibleNodes(nodes);
    return [];
  }, [nodes, flatNodeIds, isRoot, depth]);

  // Find a node by ID in the tree
  const findNodeById = React.useCallback((id: string, searchNodes: HDSINode[] = nodes): HDSINode | null => {
    for (const node of searchNodes) {
      if (node.id === id) return node;
      if (node.children.length > 0) {
        const found = findNodeById(id, node.children);
        if (found) return found;
      }
    }
    return null;
  }, [nodes]);

  // Keyboard navigation handler
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!selectedId || visibleNodeIds.length === 0) return;

    const currentIndex = visibleNodeIds.indexOf(selectedId);
    if (currentIndex === -1) return;

    const selectedNode = findNodeById(selectedId);
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          onSelect(visibleNodeIds[currentIndex - 1]);
        }
        break;

      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < visibleNodeIds.length - 1) {
          onSelect(visibleNodeIds[currentIndex + 1]);
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (selectedNode) {
          if (selectedNode.children.length > 0 && !selectedNode.expanded) {
            // Expand if collapsed and has children
            onToggle(selectedId);
          } else if (selectedNode.expanded && selectedNode.children.length > 0) {
            // Move to first child
            onSelect(selectedNode.children[0].id);
          }
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (selectedNode) {
          if (selectedNode.expanded && selectedNode.children.length > 0) {
            // Collapse if expanded
            onToggle(selectedId);
          } else {
            // Move to parent (find parent in flat list)
            // Parent is the previous node with lower depth
            for (let i = currentIndex - 1; i >= 0; i--) {
              const prevNode = findNodeById(visibleNodeIds[i]);
              if (prevNode && prevNode.depth < selectedNode.depth) {
                onSelect(visibleNodeIds[i]);
                break;
              }
            }
          }
        }
        break;

      case "Enter":
        e.preventDefault();
        if (selectedNode && selectedNode.children.length > 0) {
          onToggle(selectedId);
        }
        break;

      case "Tab":
        // Navigate to next/prev sibling
        e.preventDefault();
        if (e.shiftKey) {
          // Previous sibling - find previous node at same depth
          for (let i = currentIndex - 1; i >= 0; i--) {
            const prevNode = findNodeById(visibleNodeIds[i]);
            if (prevNode && prevNode.depth === selectedNode?.depth) {
              onSelect(visibleNodeIds[i]);
              break;
            }
          }
        } else {
          // Next sibling - find next node at same depth
          for (let i = currentIndex + 1; i < visibleNodeIds.length; i++) {
            const nextNode = findNodeById(visibleNodeIds[i]);
            if (nextNode && nextNode.depth === selectedNode?.depth) {
              onSelect(visibleNodeIds[i]);
              break;
            }
            // Stop if we hit a node with lower depth (left parent's subtree)
            if (nextNode && nextNode.depth < (selectedNode?.depth ?? 0)) {
              break;
            }
          }
        }
        break;

      case "g":
        if (modKey && onGenerate) {
          e.preventDefault();
          onGenerate(selectedId);
        }
        break;

      case "G":
        // Cmd/Ctrl+Shift+G: Generate All
        if (modKey && e.shiftKey && onGenerateAll) {
          e.preventDefault();
          onGenerateAll();
        }
        break;

      case "Delete":
      case "Backspace":
        if (modKey) {
          e.preventDefault();
          onDelete(selectedId);
        }
        break;

      case "Escape":
        e.preventDefault();
        onSelect(""); // Deselect
        break;

      case "Home":
        e.preventDefault();
        if (visibleNodeIds.length > 0) {
          onSelect(visibleNodeIds[0]);
        }
        break;

      case "End":
        e.preventDefault();
        if (visibleNodeIds.length > 0) {
          onSelect(visibleNodeIds[visibleNodeIds.length - 1]);
        }
        break;
    }
  }, [selectedId, visibleNodeIds, findNodeById, onSelect, onToggle, onGenerate, onGenerateAll, onDelete]);

  // Only attach keyboard handler at root level
  const keyboardProps = (depth === 0 || isRoot) ? {
    onKeyDown: handleKeyDown,
    tabIndex: 0,
  } : {};

  return (
    <div
      ref={depth === 0 ? treeRef : undefined}
      role={depth === 0 ? "tree" : "group"}
      aria-label={depth === 0 ? "Document structure" : undefined}
      className={cn(
        "space-y-1 outline-none",
        depth === 0 && "focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md"
      )}
      {...keyboardProps}
    >
      {nodes.map((node, index) => {
        if (node.status === "deleted") return null;

        const isSelected = selectedId === node.id;
        const isGenerating = generatingIds.has(node.id);
        const hasDebt = node.coherenceScore < 0.6 && node.status === "generated";

        return (
          <div key={node.id}>
            <div
              role="treeitem"
              aria-selected={isSelected}
              aria-expanded={node.children.length > 0 ? node.expanded : undefined}
              aria-level={depth + 1}
              aria-setsize={nodes.length}
              aria-posinset={index + 1}
              tabIndex={isSelected ? 0 : -1}
              draggable
              onDragStart={(e) => onDragStart(e, node.id)}
              onDragOver={(e) => onDragOver(e, node.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, node.id)}
              onClick={() => onSelect(node.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(node.id); // Select node on right-click
                onContextMenu?.({
                  isOpen: true,
                  x: e.clientX,
                  y: e.clientY,
                  nodeId: node.id,
                  nodeIndex: index,
                  nodeDepth: depth,
                  siblingsCount: nodes.length,
                  hasChildren: node.children.length > 0,
                });
              }}
              className={cn(
                "group flex items-center gap-1.5 p-2 rounded cursor-pointer text-sm select-none transition-colors",
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted border border-transparent",
                dragOverId === node.id && "bg-accent/50 border-accent",
                draggedId === node.id && "opacity-50",
                hasDebt && "coherence-debt"
              )}
              style={{
                marginLeft: depth * 16,
                ...(hasDebt ? { "--pulse-duration": `${Math.round(1000 / (0.5 + (0.6 - node.coherenceScore) * 5))}ms` } as React.CSSProperties : {}),
              }}
            >
              {/* Expand/Collapse Toggle */}
              {node.children.length > 0 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(node.id);
                  }}
                  className="p-0.5 hover:bg-muted rounded"
                  aria-label={node.expanded ? "Collapse" : "Expand"}
                >
                  {node.expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-5" />
              )}

              {/* Node Glyph Status Indicator */}
              <NodeGlyph
                status={node.status}
                isGenerating={isGenerating}
                coherenceScore={node.coherenceScore}
                size="sm"
                showTooltip
              />

              {/* Drag Handle */}
              <GripVertical
                className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
                aria-hidden="true"
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{node.title}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {node.type} • {node.tokenBudget} tokens
                  {node.coherenceScore < 1.0 && node.status === "generated" && (
                    <span className={cn(
                      "ml-2",
                      node.coherenceScore < 0.6 ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      {Math.round(node.coherenceScore * 100)}% coherence
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(node.id, "up");
                  }}
                  disabled={index === 0}
                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                  title="Move up"
                  aria-label="Move up"
                >
                  <MoveUp className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(node.id, "down");
                  }}
                  disabled={index === nodes.length - 1}
                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                  title="Move down"
                  aria-label="Move down"
                >
                  <MoveDown className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onIndent(node.id);
                  }}
                  disabled={index === 0}
                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                  title="Indent (make subsection)"
                  aria-label="Indent"
                >
                  <Indent className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOutdent(node.id);
                  }}
                  disabled={depth === 0}
                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                  title="Outdent (move up level)"
                  aria-label="Outdent"
                >
                  <Outdent className="h-3 w-3" />
                </button>
                {onGenerate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerate(node.id);
                    }}
                    disabled={isGenerating}
                    className="p-1 hover:bg-primary/10 hover:text-primary rounded disabled:opacity-30"
                    title="Generate content with AI (⌘G)"
                    aria-label="Generate content"
                  >
                    <Sparkles className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(node.id);
                  }}
                  className="p-1 hover:bg-destructive hover:text-destructive-foreground rounded"
                  title="Delete (⌘⌫)"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Children */}
            {node.expanded && node.children.length > 0 && (
              <div className="mt-1">
                <TreeView
                  nodes={node.children}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onGenerate={onGenerate}
                  onGenerateAll={onGenerateAll}
                  onMove={onMove}
                  onIndent={onIndent}
                  onOutdent={onOutdent}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  draggedId={draggedId}
                  dragOverId={dragOverId}
                  generatingIds={generatingIds}
                  depth={depth + 1}
                  flatNodeIds={visibleNodeIds}
                  contextMenu={contextMenu}
                  onContextMenu={onContextMenu}
                  onCloseContextMenu={onCloseContextMenu}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Context Menu - only rendered at root level */}
      {depth === 0 && contextMenu?.isOpen && (
        <>
          {/* Backdrop to close menu on click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => onCloseContextMenu?.()}
            onContextMenu={(e) => {
              e.preventDefault();
              onCloseContextMenu?.();
            }}
          />
          {/* Context Menu */}
          <div
            className="fixed z-50 min-w-[180px] bg-popover border rounded-md shadow-lg p-1 animate-in fade-in-0 zoom-in-95"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Generate */}
            {onGenerate && (
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted"
                onClick={() => {
                  onGenerate(contextMenu.nodeId);
                  onCloseContextMenu?.();
                }}
              >
                <Sparkles className="h-4 w-4" />
                Generate Content
              </button>
            )}

            <div className="h-px bg-border my-1" />

            {/* Move Up */}
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                onMove(contextMenu.nodeId, "up");
                onCloseContextMenu?.();
              }}
              disabled={contextMenu.nodeIndex === 0}
            >
              <MoveUp className="h-4 w-4" />
              Move Up
            </button>

            {/* Move Down */}
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                onMove(contextMenu.nodeId, "down");
                onCloseContextMenu?.();
              }}
              disabled={contextMenu.nodeIndex === contextMenu.siblingsCount - 1}
            >
              <MoveDown className="h-4 w-4" />
              Move Down
            </button>

            <div className="h-px bg-border my-1" />

            {/* Promote (Outdent) - decrease depth */}
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                onOutdent(contextMenu.nodeId);
                onCloseContextMenu?.();
              }}
              disabled={contextMenu.nodeDepth === 0}
              title="Move up one level in the hierarchy"
            >
              <Outdent className="h-4 w-4" />
              Promote (Outdent)
            </button>

            {/* Demote (Indent) - increase depth */}
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                onIndent(contextMenu.nodeId);
                onCloseContextMenu?.();
              }}
              disabled={contextMenu.nodeIndex === 0}
              title="Make this a subsection of the previous sibling"
            >
              <Indent className="h-4 w-4" />
              Demote (Indent)
            </button>

            <div className="h-px bg-border my-1" />

            {/* Expand/Collapse (if has children) */}
            {contextMenu.hasChildren && (
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted"
                onClick={() => {
                  onToggle(contextMenu.nodeId);
                  onCloseContextMenu?.();
                }}
              >
                <ChevronRight className="h-4 w-4" />
                Expand/Collapse
              </button>
            )}

            {/* Delete */}
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => {
                onDelete(contextMenu.nodeId);
                onCloseContextMenu?.();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default HDSIEnhanced;
