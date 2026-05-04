/**
 * OutlineBuilder Component - DocFusion
 *
 * Visual hierarchy editor for document synthesis outline.
 * Features drag-and-drop node reordering, add/remove nodes,
 * and collapsible tree view.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ChevronRight,
	ChevronDown,
	Plus,
	Trash2,
	GripVertical,
	MoreVertical,
	Book,
	Section,
	FileText,
	Text,
	Check,
	Loader2,
	Clock,
	AlertCircle,
} from "lucide-react";
import type { StructuralNode, NodeType } from "@/lib/types/document-synthesis";
import {
	canContainChildren,
	getAllowedChildTypes,
	getNodeTypeLabel,
	generateNodeId,
	calculatePath,
	getDefaultMetadata,
} from "@/lib/types/document-synthesis";

// ============================================================================
// Types
// ============================================================================

export interface OutlineBuilderProps {
	/** All structural nodes */
	nodes: StructuralNode[];
	/** Active/selected node ID */
	selectedNodeId?: string | null;
	/** Called when node is selected */
	onSelectNode?: (nodeId: string) => void;
	/** Called when nodes structure changes */
	onNodesChange?: (nodes: StructuralNode[]) => void;
	/** Additional CSS class */
	className?: string;
}

interface TreeNodeProps {
	node: StructuralNode;
	allNodes: StructuralNode[];
	level: number;
	selectedNodeId?: string | null;
	expandedNodes: Set<string>;
	draggedNodeId: string | null;
	onToggleExpand: (nodeId: string) => void;
	onSelect: (nodeId: string) => void;
	onDragStart: (nodeId: string) => void;
	onDragEnd: () => void;
	onDrop: (targetId: string, position: "before" | "after" | "inside") => void;
	onAddChild: (parentId: string, type: NodeType) => void;
	onRemove: (nodeId: string) => void;
	onUpdatePrompt: (nodeId: string, prompt: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function OutlineBuilder({
	nodes,
	selectedNodeId,
	onSelectNode,
	onNodesChange,
	className,
}: OutlineBuilderProps) {
	const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(
		() => new Set(nodes.map((n) => n.uuid))
	);
	const [draggedNodeId, setDraggedNodeId] = React.useState<string | null>(null);

	// Update expanded set when nodes change
	React.useEffect(() => {
		setExpandedNodes((prev) => {
			const newSet = new Set(prev);
			for (const node of nodes) {
				if (!newSet.has(node.uuid)) {
					newSet.add(node.uuid);
				}
			}
			return newSet;
		});
	}, [nodes]);

	// Build node map for quick lookup
	const nodeMap = React.useMemo(() => {
		return new Map(nodes.map((n) => [n.uuid, n]));
	}, [nodes]);

	// Get root nodes
	const rootNodes = React.useMemo(() => {
		return nodes.filter((n) => n.parentId === null);
	}, [nodes]);

	// Toggle node expansion
	const toggleExpand = React.useCallback((nodeId: string) => {
		setExpandedNodes((prev) => {
			const next = new Set(prev);
			if (next.has(nodeId)) {
				next.delete(nodeId);
			} else {
				next.add(nodeId);
			}
			return next;
		});
	}, []);

	// Drag handlers
	const handleDragStart = React.useCallback((nodeId: string) => {
		setDraggedNodeId(nodeId);
	}, []);

	const handleDragEnd = React.useCallback(() => {
		setDraggedNodeId(null);
	}, []);

	// Drop handler
	const handleDrop = React.useCallback(
		(targetId: string, position: "before" | "after" | "inside") => {
			if (!draggedNodeId || draggedNodeId === targetId) {
				setDraggedNodeId(null);
				return;
			}

			// Prevent dropping into own descendants
			const isDescendant = (parentId: string, childId: string): boolean => {
				const child = nodeMap.get(childId);
				if (!child) return false;
				if (child.parentId === parentId) return true;
				if (child.parentId) return isDescendant(parentId, child.parentId);
				return false;
			};

			if (isDescendant(draggedNodeId, targetId)) {
				setDraggedNodeId(null);
				return;
			}

			// Perform the move
			const newNodes = moveNode(draggedNodeId, targetId, position, nodes);
			onNodesChange?.(newNodes);
			setDraggedNodeId(null);
		},
		[draggedNodeId, nodeMap, nodes, onNodesChange]
	);

	// Add child node
	const handleAddChild = React.useCallback(
		(parentId: string, type: NodeType) => {
			const newNodes = addChildNode(parentId, type, nodes);
			onNodesChange?.(newNodes);
		},
		[nodes, onNodesChange]
	);

	// Remove node
	const handleRemove = React.useCallback(
		(nodeId: string) => {
			const newNodes = removeNode(nodeId, nodes);
			onNodesChange?.(newNodes);
		},
		[nodes, onNodesChange]
	);

	// Update node prompt
	const handleUpdatePrompt = React.useCallback(
		(nodeId: string, prompt: string) => {
			const newNodes = nodes.map((n) =>
				n.uuid === nodeId
					? { ...n, metadata: { ...n.metadata, customPrompt: prompt } }
					: n
			);
			onNodesChange?.(newNodes);
		},
		[nodes, onNodesChange]
	);

	// Expand all
	const expandAll = React.useCallback(() => {
		setExpandedNodes(new Set(nodes.map((n) => n.uuid)));
	}, [nodes]);

	// Collapse all
	const collapseAll = React.useCallback(() => {
		setExpandedNodes(new Set());
	}, []);

	return (
		<div
			className={cn(
				"flex flex-col h-full bg-card border rounded-lg overflow-hidden",
				className
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
				<div className="flex items-center gap-2">
					<Book className="h-4 w-4 text-muted-foreground" />
					<h3 className="font-semibold text-sm">Document Outline</h3>
					<span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
						{nodes.length} sections
					</span>
				</div>
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={expandAll}
								className="p-1.5 text-muted-foreground hover:text-foreground rounded"
							>
								<ChevronDown className="h-4 w-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent>Expand all</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={collapseAll}
								className="p-1.5 text-muted-foreground hover:text-foreground rounded"
							>
								<ChevronRight className="h-4 w-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent>Collapse all</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* Tree content */}
			<div className="flex-1 overflow-y-auto p-2">
				{rootNodes.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
						<Book className="h-8 w-8 mb-2 opacity-50" />
						<p className="text-sm">No outline generated yet</p>
					</div>
				) : (
					<div className="space-y-0.5">
						{rootNodes.map((node) => (
							<TreeNode
								key={node.uuid}
								node={node}
								allNodes={nodes}
								level={0}
								selectedNodeId={selectedNodeId}
								expandedNodes={expandedNodes}
								draggedNodeId={draggedNodeId}
								onToggleExpand={toggleExpand}
								onSelect={onSelectNode || (() => {})}
								onDragStart={handleDragStart}
								onDragEnd={handleDragEnd}
								onDrop={handleDrop}
								onAddChild={handleAddChild}
								onRemove={handleRemove}
								onUpdatePrompt={handleUpdatePrompt}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Tree Node Component
// ============================================================================

function TreeNode({
	node,
	allNodes,
	level,
	selectedNodeId,
	expandedNodes,
	draggedNodeId,
	onToggleExpand,
	onSelect,
	onDragStart,
	onDragEnd,
	onDrop,
	onAddChild,
	onRemove,
	onUpdatePrompt,
}: TreeNodeProps) {
	const [isDragOver, setIsDragOver] = React.useState<"before" | "after" | "inside" | null>(null);
	const [isEditing, setIsEditing] = React.useState(false);
	const [editValue, setEditValue] = React.useState(node.metadata.customPrompt);

	const hasChildren = node.children.length > 0;
	const isExpanded = expandedNodes.has(node.uuid);
	const isSelected = selectedNodeId === node.uuid;
	const isDragged = draggedNodeId === node.uuid;

	const childNodes = React.useMemo(() => {
		return node.children.map((id) => allNodes.find((n) => n.uuid === id)!).filter(Boolean);
	}, [node.children, allNodes]);

	// Status icon
	const StatusIcon = () => {
		switch (node.status) {
			case "completed":
				return <Check className="h-3 w-3 text-green-500" />;
			case "generating":
		case "regenerating":
				return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
			case "failed":
				return <AlertCircle className="h-3 w-3 text-destructive" />;
			default:
				return <Clock className="h-3 w-3 text-muted-foreground" />;
		}
	};

	// Type icon
	const TypeIcon = () => {
		switch (node.type) {
			case "chapter":
				return <Book className="h-4 w-4" />;
			case "section":
				return <Section className="h-4 w-4" />;
			case "subsection":
				return <FileText className="h-4 w-4" />;
			default:
				return <Text className="h-4 w-4" />;
		}
	};

	// Drag event handlers
	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.setData("text/plain", node.uuid);
		e.dataTransfer.effectAllowed = "move";
		onDragStart(node.uuid);
	};

	const handleDragEnd = () => {
		onDragEnd();
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";

		// Calculate drop position based on mouse position
		const rect = e.currentTarget.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const height = rect.height;

		if (y < height * 0.25) {
			setIsDragOver("before");
		} else if (y > height * 0.75) {
			setIsDragOver("after");
		} else {
			setIsDragOver("inside");
		}
	};

	const handleDragLeave = () => {
		setIsDragOver(null);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (isDragOver) {
			onDrop(node.uuid, isDragOver);
		}
		setIsDragOver(null);
	};

	// Edit handlers
	const handleSave = () => {
		onUpdatePrompt(node.uuid, editValue);
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setEditValue(node.metadata.customPrompt);
			setIsEditing(false);
		}
	};

	return (
		<div className="select-none">
			<div
				draggable
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={cn(
					"group flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer",
					isSelected && "bg-primary/10 ring-1 ring-primary/50",
					!isSelected && "hover:bg-muted",
					isDragged && "opacity-50",
					isDragOver === "before" && "border-t-2 border-primary",
					isDragOver === "after" && "border-b-2 border-primary",
					isDragOver === "inside" && "bg-primary/5 ring-1 ring-primary/30"
				)}
				style={{ paddingLeft: `${level * 12 + 8}px` }}
				onClick={() => onSelect(node.uuid)}

	role="button"
	tabIndex={0}
	onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
				{/* Drag handle */}
				<GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing" />

				{/* Expand/collapse */}
				{hasChildren ? (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onToggleExpand(node.uuid);
						}}
						className="p-0.5 hover:bg-muted rounded"
					>
						{isExpanded ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</button>
				) : (
					<span className="w-5" />
				)}

				{/* Type icon */}
				<TypeIcon />

				{/* Status indicator */}
				<StatusIcon />

				{/* Path badge */}
				<span className="text-xs text-muted-foreground font-mono min-w-[24px]">
					{node.path}
				</span>

				{/* Content */}
				<div className="flex-1 min-w-0">
					{isEditing ? (
						<Input
							value={editValue}
							onChange={(e) => setEditValue(e.target.value)}
							onBlur={handleSave}
							onKeyDown={handleKeyDown}
							className="h-6 py-0 text-sm"
							onClick={(e) => e.stopPropagation()}
						/>
					) : (
						<span
							className="text-sm truncate block"
							onDoubleClick={(e) => {
								e.stopPropagation();
								setIsEditing(true);
							}}
						>
							{node.metadata.customPrompt}
						</span>
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
					<AddChildButton onAdd={(type) => onAddChild(node.uuid, type)} />

					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={(e) => {
									e.stopPropagation();
									onRemove(node.uuid);
								}}
								className="p-1 text-muted-foreground hover:text-destructive rounded"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</TooltipTrigger>
						<TooltipContent>Remove section</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* Children */}
			{hasChildren && isExpanded && (
				<div className="ml-2 border-l border-border/50">
					{childNodes.map((child) => (
						<TreeNode
							key={child.uuid}
							node={child}
							allNodes={allNodes}
							level={level + 1}
							selectedNodeId={selectedNodeId}
							expandedNodes={expandedNodes}
							draggedNodeId={draggedNodeId}
							onToggleExpand={onToggleExpand}
							onSelect={onSelect}
							onDragStart={onDragStart}
							onDragEnd={onDragEnd}
							onDrop={onDrop}
							onAddChild={onAddChild}
							onRemove={onRemove}
							onUpdatePrompt={onUpdatePrompt}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Helper Components
// ============================================================================

function AddChildButton({ onAdd }: { onAdd: (type: NodeType) => void }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="p-1 text-muted-foreground hover:text-foreground rounded">
					<Plus className="h-3.5 w-3.5" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => onAdd("section")}>
					<Section className="h-4 w-4 mr-2" />
					Add Section
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onAdd("subsection")}>
					<FileText className="h-4 w-4 mr-2" />
					Add Subsection
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onAdd("paragraph")}>
					<Text className="h-4 w-4 mr-2" />
					Add Paragraph
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ============================================================================
// Utility Functions
// ============================================================================

function moveNode(
	draggedId: string,
	targetId: string,
	position: "before" | "after" | "inside",
	nodes: StructuralNode[]
): StructuralNode[] {
	const draggedNode = nodes.find((n) => n.uuid === draggedId);
	const targetNode = nodes.find((n) => n.uuid === targetId);
	if (!draggedNode || !targetNode) return nodes;

	// Update parent references
	let newNodes = nodes.map((n) => {
		// Remove dragged from its old parent's children
		if (n.uuid === draggedNode.parentId) {
			return { ...n, children: n.children.filter((id) => id !== draggedId) };
		}
		return n;
	});

	// Add to new position
	if (position === "inside") {
		// Become child of target
		newNodes = newNodes.map((n) => {
			if (n.uuid === targetId) {
				return { ...n, children: [...n.children, draggedId] };
			}
			if (n.uuid === draggedId) {
				return { ...n, parentId: targetId };
			}
			return n;
		});
	} else {
		// Before or after target - share same parent
		const newParentId = targetNode.parentId;
		const siblings = newNodes.filter((n) => n.parentId === newParentId);
		const targetIndex = siblings.findIndex((n) => n.uuid === targetId);

		newNodes = newNodes.map((n) => {
			if (n.uuid === draggedId) {
				return { ...n, parentId: newParentId };
			}
			if (n.parentId === newParentId) {
				const currentIndex = siblings.findIndex((s) => s.uuid === n.uuid);
				let newIndex = currentIndex;

				if (n.uuid === draggedId) {
					newIndex = position === "before" ? targetIndex : targetIndex + 1;
				}

				return { ...n, children: n.children };
			}
			return n;
		});
	}

	// Recalculate paths
	return recalculatePaths(newNodes);
}

function addChildNode(
	parentId: string,
	type: NodeType,
	nodes: StructuralNode[]
): StructuralNode[] {
	const parent = nodes.find((n) => n.uuid === parentId);
	if (!parent) return nodes;

	const newNode: StructuralNode = {
		uuid: generateNodeId(),
		path: calculatePath(parent.path, parent.children.length),
		type,
		parentId,
		children: [],
		metadata: {
			...getDefaultMetadata(type),
			customPrompt: `New ${getNodeTypeLabel(type)}`,
		},
		status: "pending",
	};

	return [
		...nodes.map((n) =>
			n.uuid === parentId ? { ...n, children: [...n.children, newNode.uuid] } : n
		),
		newNode,
	];
}

function removeNode(nodeId: string, nodes: StructuralNode[]): StructuralNode[] {
	const target = nodes.find((n) => n.uuid === nodeId);
	if (!target) return nodes;

	// Collect all descendants to remove
	const toRemove = new Set<string>();
	const collectIds = (id: string) => {
		const node = nodes.find((n) => n.uuid === id);
		if (!node) return;
		toRemove.add(id);
		node.children.forEach(collectIds);
	};
	collectIds(nodeId);

	// Filter out removed nodes and update parent's children
	let newNodes = nodes.filter((n) => !toRemove.has(n.uuid));
	if (target.parentId) {
		newNodes = newNodes.map((n) =>
			n.uuid === target.parentId
				? { ...n, children: n.children.filter((id) => id !== nodeId) }
				: n
		);
	}

	// Recalculate paths
	return recalculatePaths(newNodes);
}

function recalculatePaths(nodes: StructuralNode[]): StructuralNode[] {
	const nodeMap = new Map(nodes.map((n) => [n.uuid, n]));

	const calculatePath = (node: StructuralNode, siblingIndex: number): string => {
		if (!node.parentId) return String(siblingIndex + 1);
		const parent = nodeMap.get(node.parentId);
		if (!parent) return String(siblingIndex + 1);
		return `${parent.path}.${siblingIndex + 1}`;
	};

	return nodes.map((node) => {
		const siblings = nodes.filter((n) => n.parentId === node.parentId);
		const index = siblings.findIndex((n) => n.uuid === node.uuid);
		return { ...node, path: calculatePath(node, index) };
	});
}

export default OutlineBuilder;
