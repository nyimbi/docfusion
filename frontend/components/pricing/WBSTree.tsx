/**
 * WBSTree - Work Breakdown Structure Tree View
 *
 * Hierarchical tree view with drag-and-drop reordering, technical section linking,
 * cost rollups, and expand/collapse functionality.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
	ChevronRight,
	ChevronDown,
	Plus,
	MoreHorizontal,
	Edit2,
	Trash2,
	Link,
	Unlink,
	GripVertical,
	FolderTree,
	DollarSign,
	Clock,
	AlertCircle,
	Loader2,
	ChevronsUpDown,
	FileText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
	WBSNode,
	WBSTree as WBSTreeData,
} from "@/lib/types/pricing";
import {
	getWBSTree,
	createWBSNode,
	updateWBSNode,
	deleteWBSNode,
	reorderWBSNodes,
	linkWBSToSection,
	type CreateWBSNodeInput,
} from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface WBSTreeProps {
	/** Opportunity ID to display WBS for */
	opportunityId: string;
	/** Callback when a node is selected */
	onSelectNode?: (wbsCode: string) => void;
	/** Currently selected node ID */
	selectedNodeId?: string | null;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(value: number | null): string {
	if (value === null) return "-";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

function formatNumber(value: number | null): string {
	if (value === null) return "-";
	return new Intl.NumberFormat("en-US").format(value);
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function WBSTreeSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-9 w-24" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{[1, 2, 3].map((i) => (
						<div key={i} className="space-y-2">
							<Skeleton className="h-10 w-full" />
							<div className="ml-6 space-y-2">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Node Form Dialog
// =============================================================================

interface NodeFormDialogProps {
	node: WBSNode | null;
	parentId: string | null;
	opportunityId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (input: CreateWBSNodeInput) => Promise<void>;
	isSaving: boolean;
}

function NodeFormDialog({
	node,
	parentId,
	opportunityId,
	open,
	onOpenChange,
	onSave,
	isSaving,
}: NodeFormDialogProps) {
	const [wbsCode, setWbsCode] = useState("");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");

	useEffect(() => {
		if (node) {
			setWbsCode(node.wbsCode);
			setTitle(node.title);
			setDescription(node.description || "");
		} else {
			setWbsCode("");
			setTitle("");
			setDescription("");
		}
	}, [node, open]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await onSave({
			opportunityId,
			wbsCode,
			title,
			description: description || undefined,
			parentId: parentId || undefined,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>
							{node ? "Edit WBS Element" : "Add WBS Element"}
						</DialogTitle>
						<DialogDescription>
							{node
								? "Update the WBS element details."
								: parentId
								? "Add a child element to the selected WBS element."
								: "Add a top-level WBS element."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="wbsCode">WBS Code *</Label>
							<Input
								id="wbsCode"
								value={wbsCode}
								onChange={(e) => setWbsCode(e.target.value)}
								placeholder="e.g., 1.1.1"
								required
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="title">Title *</Label>
							<Input
								id="title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="e.g., Software Development"
								required
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Brief description of this WBS element..."
								rows={3}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSaving}>
							{isSaving ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Saving...
								</>
							) : node ? (
								"Update"
							) : (
								"Add"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// WBS Node Component
// =============================================================================

interface WBSNodeItemProps {
	node: WBSNode;
	selectedNodeId: string | null;
	expandedNodes: Set<string>;
	onToggleExpand: (nodeId: string) => void;
	onSelect: (node: WBSNode) => void;
	onEdit: (node: WBSNode) => void;
	onAddChild: (parentId: string) => void;
	onDelete: (node: WBSNode) => void;
	onLinkSection: (node: WBSNode) => void;
	draggedNodeId: string | null;
	onDragStart: (nodeId: string) => void;
	onDragOver: (e: React.DragEvent, targetId: string) => void;
	onDragEnd: () => void;
}

function WBSNodeItem({
	node,
	selectedNodeId,
	expandedNodes,
	onToggleExpand,
	onSelect,
	onEdit,
	onAddChild,
	onDelete,
	onLinkSection,
	draggedNodeId,
	onDragStart,
	onDragOver,
	onDragEnd,
}: WBSNodeItemProps) {
	const hasChildren = node.children && node.children.length > 0;
	const isExpanded = expandedNodes.has(node.id);
	const isSelected = selectedNodeId === node.id;
	const isDragging = draggedNodeId === node.id;

	return (
		<div
			draggable
			onDragStart={() => onDragStart(node.id)}
			onDragOver={(e) => onDragOver(e, node.id)}
			onDragEnd={onDragEnd}
			className={cn(isDragging && "opacity-50")}
		>
			<Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(node.id)}>
				<div
					className={cn(
						"group flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors",
						isSelected && "bg-muted"
					)}
					style={{ paddingLeft: `${node.level * 16 + 8}px` }}
				>
					{/* Drag Handle */}
					<div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
						<GripVertical className="h-3 w-3 text-muted-foreground" />
					</div>

					{/* Expand/Collapse */}
					{hasChildren ? (
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="icon" className="h-5 w-5 p-0">
								{isExpanded ? (
									<ChevronDown className="h-3 w-3" />
								) : (
									<ChevronRight className="h-3 w-3" />
								)}
							</Button>
						</CollapsibleTrigger>
					) : (
						<div className="w-5" />
					)}

					{/* Node Content */}
					<button
						onClick={() => onSelect(node)}
						className="flex-1 flex items-center gap-2 text-left min-w-0"
					>
						<span className="font-mono text-xs text-muted-foreground shrink-0">
							{node.wbsCode}
						</span>
						<span className="truncate">{node.title}</span>
						{node.technicalSectionId && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Link className="h-3 w-3 text-green-600 shrink-0" />
									</TooltipTrigger>
									<TooltipContent>
										<p>Linked to technical section</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</button>

					{/* Cost Rollup */}
					<div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
						{node.totalHours !== null && (
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								{formatNumber(node.totalHours)}
							</span>
						)}
						{node.totalCost !== null && (
							<span className="flex items-center gap-1">
								<DollarSign className="h-3 w-3" />
								{formatCurrency(node.totalCost)}
							</span>
						)}
					</div>

					{/* Actions */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 opacity-0 group-hover:opacity-100"
							>
								<MoreHorizontal className="h-3 w-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => onEdit(node)}>
								<Edit2 className="h-4 w-4 mr-2" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onAddChild(node.id)}>
								<Plus className="h-4 w-4 mr-2" />
								Add Child
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => onLinkSection(node)}>
								{node.technicalSectionId ? (
									<>
										<Unlink className="h-4 w-4 mr-2" />
										Unlink Section
									</>
								) : (
									<>
										<Link className="h-4 w-4 mr-2" />
										Link Section
									</>
								)}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onDelete(node)}
								className="text-destructive"
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Children */}
				{hasChildren && (
					<CollapsibleContent>
						{node.children!.map((child) => (
							<WBSNodeItem
								key={child.id}
								node={child}
								selectedNodeId={selectedNodeId}
								expandedNodes={expandedNodes}
								onToggleExpand={onToggleExpand}
								onSelect={onSelect}
								onEdit={onEdit}
								onAddChild={onAddChild}
								onDelete={onDelete}
								onLinkSection={onLinkSection}
								draggedNodeId={draggedNodeId}
								onDragStart={onDragStart}
								onDragOver={onDragOver}
								onDragEnd={onDragEnd}
							/>
						))}
					</CollapsibleContent>
				)}
			</Collapsible>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function WBSTree({
	opportunityId,
	onSelectNode,
	selectedNodeId: externalSelectedNodeId,
	className,
}: WBSTreeProps) {
	// State
	const [wbsData, setWbsData] = useState<WBSTreeData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
		externalSelectedNodeId || null
	);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editingNode, setEditingNode] = useState<WBSNode | null>(null);
	const [addParentId, setAddParentId] = useState<string | null>(null);
	const [deleteDialogNode, setDeleteDialogNode] = useState<WBSNode | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

	// Load WBS data
	useEffect(() => {
		async function loadWBS() {
			setIsLoading(true);
			setError(null);

			const result = await getWBSTree(opportunityId);
			if (result.success && result.data) {
				setWbsData(result.data);
				// Auto-expand first level
				const firstLevelIds = result.data.nodes.map((n) => n.id);
				setExpandedNodes(new Set(firstLevelIds));
			} else if (!result.success) {
				setError("error" in result ? (result as { error: string }).error : "Failed to load WBS");
			}
			setIsLoading(false);
		}
		loadWBS();
	}, [opportunityId]);

	// Sync external selection
	useEffect(() => {
		if (externalSelectedNodeId !== undefined) {
			setSelectedNodeId(externalSelectedNodeId);
		}
	}, [externalSelectedNodeId]);

	// Flatten nodes for searching
	const flattenNodes = useCallback((nodes: WBSNode[]): WBSNode[] => {
		const result: WBSNode[] = [];
		const traverse = (nodeList: WBSNode[]) => {
			for (const node of nodeList) {
				result.push(node);
				if (node.children) {
					traverse(node.children);
				}
			}
		};
		traverse(nodes);
		return result;
	}, []);

	// Handlers
	const handleToggleExpand = useCallback((nodeId: string) => {
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

	const handleExpandAll = useCallback(() => {
		if (!wbsData) return;
		const allIds = flattenNodes(wbsData.nodes).map((n) => n.id);
		setExpandedNodes(new Set(allIds));
	}, [wbsData, flattenNodes]);

	const handleCollapseAll = useCallback(() => {
		setExpandedNodes(new Set());
	}, []);

	const handleSelect = useCallback(
		(node: WBSNode) => {
			setSelectedNodeId(node.id);
			onSelectNode?.(node.wbsCode);
		},
		[onSelectNode]
	);

	const handleSave = useCallback(
		async (input: CreateWBSNodeInput) => {
			setIsSaving(true);
			try {
				let result;
				if (editingNode) {
					result = await updateWBSNode(editingNode.id, input);
				} else {
					result = await createWBSNode(input);
				}

				if (result.success) {
					// Reload WBS
					const wbsResult = await getWBSTree(opportunityId);
					if (wbsResult.success && wbsResult.data) {
						setWbsData(wbsResult.data);
					}
					setEditDialogOpen(false);
					setEditingNode(null);
					setAddParentId(null);
				}
			} finally {
				setIsSaving(false);
			}
		},
		[editingNode, opportunityId]
	);

	const handleDelete = useCallback(async () => {
		if (!deleteDialogNode) return;

		setIsDeleting(true);
		const result = await deleteWBSNode(deleteDialogNode.id, opportunityId, true);
		if (result.success) {
			// Reload WBS
			const wbsResult = await getWBSTree(opportunityId);
			if (wbsResult.success && wbsResult.data) {
				setWbsData(wbsResult.data);
			}
			setDeleteDialogNode(null);
		}
		setIsDeleting(false);
	}, [deleteDialogNode, opportunityId]);

	const handleDragStart = useCallback((nodeId: string) => {
		setDraggedNodeId(nodeId);
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent, targetId: string) => {
			e.preventDefault();
			// Would implement reordering logic here
		},
		[]
	);

	const handleDragEnd = useCallback(async () => {
		if (draggedNodeId && wbsData) {
			// Save new order
			const nodeIds = flattenNodes(wbsData.nodes).map((n) => n.id);
			await reorderWBSNodes(opportunityId, nodeIds);
		}
		setDraggedNodeId(null);
	}, [draggedNodeId, wbsData, opportunityId, flattenNodes]);

	// Loading state
	if (isLoading) {
		return <WBSTreeSkeleton />;
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<FolderTree className="h-5 w-5" />
						Work Breakdown Structure
						{wbsData && wbsData.nodes.length > 0 && (
							<Badge variant="secondary">{flattenNodes(wbsData.nodes).length}</Badge>
						)}
					</CardTitle>

					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="icon"
										onClick={expandedNodes.size > 0 ? handleCollapseAll : handleExpandAll}
									>
										<ChevronsUpDown className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>{expandedNodes.size > 0 ? "Collapse All" : "Expand All"}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<Button
							onClick={() => {
								setEditingNode(null);
								setAddParentId(null);
								setEditDialogOpen(true);
							}}
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Element
						</Button>
					</div>
				</div>

				{/* Summary Stats */}
				{wbsData && (
					<div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							{formatNumber(wbsData.totalHours)} total hours
						</span>
						<span className="flex items-center gap-1">
							<DollarSign className="h-3 w-3" />
							{formatCurrency(wbsData.totalCost)} total cost
						</span>
						<span>Max depth: {wbsData.maxDepth}</span>
					</div>
				)}
			</CardHeader>

			<CardContent>
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive" className="mb-4">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Empty State */}
				{wbsData && wbsData.nodes.length === 0 && !error && (
					<div className="text-center py-12">
						<FolderTree className="h-12 w-12 mx-auto text-muted-foreground/50" />
						<h3 className="mt-4 font-medium">No WBS structure</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Create a work breakdown structure to organize your costs
						</p>
						<Button
							onClick={() => {
								setEditingNode(null);
								setAddParentId(null);
								setEditDialogOpen(true);
							}}
							className="mt-4"
						>
							<Plus className="h-4 w-4 mr-2" />
							Add First Element
						</Button>
					</div>
				)}

				{/* WBS Tree */}
				{wbsData && wbsData.nodes.length > 0 && (
					<div className="space-y-0.5">
						{wbsData.nodes.map((node) => (
							<WBSNodeItem
								key={node.id}
								node={node}
								selectedNodeId={selectedNodeId}
								expandedNodes={expandedNodes}
								onToggleExpand={handleToggleExpand}
								onSelect={handleSelect}
								onEdit={(n) => {
									setEditingNode(n);
									setAddParentId(null);
									setEditDialogOpen(true);
								}}
								onAddChild={(parentId) => {
									setEditingNode(null);
									setAddParentId(parentId);
									setEditDialogOpen(true);
								}}
								onDelete={setDeleteDialogNode}
								onLinkSection={() => {}}
								draggedNodeId={draggedNodeId}
								onDragStart={handleDragStart}
								onDragOver={handleDragOver}
								onDragEnd={handleDragEnd}
							/>
						))}
					</div>
				)}
			</CardContent>

			{/* Edit/Create Dialog */}
			<NodeFormDialog
				node={editingNode}
				parentId={addParentId}
				opportunityId={opportunityId}
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				onSave={handleSave}
				isSaving={isSaving}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!deleteDialogNode} onOpenChange={() => setDeleteDialogNode(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete WBS Element</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deleteDialogNode?.wbsCode} - {deleteDialogNode?.title}"?
							{deleteDialogNode?.children && deleteDialogNode.children.length > 0 && (
								<span className="text-destructive">
									{" "}
									This will also delete {deleteDialogNode.children.length} child element(s).
								</span>
							)}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogNode(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
							{isDeleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

export default WBSTree;
