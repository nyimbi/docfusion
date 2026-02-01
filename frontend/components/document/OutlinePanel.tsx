"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { List, RefreshCw, Sparkles, Plus, Heading1, Heading2, Heading3 } from "lucide-react";
import { OutlineItem, OutlineItemSkeleton } from "./OutlineItem";
import type { Editor } from "@tiptap/react";
import type {
	OutlineItem as OutlineItemType,
	DocumentOutline,
} from "@/lib/editor/extensions/outline";
import type {
	DropPosition,
	DragMode,
} from "@/lib/editor/extensions/drag-drop";
import { Button } from "@/components/ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Props for OutlinePanel component
 */
export interface OutlinePanelProps {
	/** Document outline data */
	outline?: DocumentOutline | null;
	/** Currently active section ID */
	activeSectionId?: string | null;
	/** Callback when a section is clicked */
	onSectionClick?: (item: OutlineItemType) => void;
	/** Callback when section is toggled */
	onToggleCollapse?: (item: OutlineItemType, collapsed: boolean) => void;
	/** Callback when drag starts */
	onDragStart?: (item: OutlineItemType, mode: DragMode) => void;
	/** Callback when drag ends */
	onDragEnd?: (success: boolean) => void;
	/** Callback when section is dropped */
	onDrop?: (source: OutlineItemType, target: DropPosition) => boolean;
	/** Currently dragged item ID */
	draggedItemId?: string | null;
	/** Hover target position */
	hoverTarget?: DropPosition | null;
	/** Whether drag operation is valid */
	isDropValid?: boolean;
	/** Set of collapsed section IDs */
	collapsedSections?: Set<string>;
	/** Whether outline is loading */
	isLoading?: boolean;
	/** Error message to display */
	error?: string | null;
	/** Custom className */
	className?: string;
	/** Whether drag-and-drop is enabled */
	enableDragDrop?: boolean;
	/** Maximum depth to display (1-6) */
	maxDepth?: number;
	/** Panel title */
	title?: string;
	/** Called when refresh is requested */
	onRefresh?: () => void;
	/** Called to expand all sections */
	onExpandAll?: () => void;
	/** Called to collapse all sections */
	onCollapseAll?: () => void;
	/** Editor instance for quick inserts */
	editor?: Editor | null;

}

/**
 * Outline panel showing document structure with hierarchical view.
 *
 * Displays headings as a navigable tree with support for:
 * - Expand/collapse sections
 * - Click to navigate to section
 * - Drag-and-drop for reordering
 * - Active section highlighting
 * - Empty state with quick actions
 *
 * @example
 * <OutlinePanel
 *   outline={documentOutline}
 *   activeSectionId={currentSection}
 *   onSectionClick={navigateToSection}
 *   editor={editor}
 *   enableDragDrop
 *   maxDepth={3}
 * />
 */
export const OutlinePanel = React.memo(function OutlinePanel({
	outline,
	activeSectionId,
	onSectionClick,
	onToggleCollapse,
	onDragStart,
	onDragEnd,
	onDrop,
	draggedItemId,
	hoverTarget,
	isDropValid = true,
	collapsedSections = new Set(),
	isLoading = false,
	error = null,
	className,
	enableDragDrop = false,
	maxDepth = 6,
	title = "Outline",
	onRefresh,
	onExpandAll,
	onCollapseAll,
	editor,
}: OutlinePanelProps) {
	// Handle section click
	const handleSectionClick = React.useCallback(
		(item: OutlineItemType) => {
			onSectionClick?.(item);
		},
		[onSectionClick]
	);

	// Handle drag start from item
	const handleDragStart = React.useCallback(
		(item: OutlineItemType, _event: React.DragEvent) => {
			onDragStart?.(item, "move");
		},
		[onDragStart]
	);

	// Quick insert heading
	const insertHeading = React.useCallback(
		(level: 1 | 2 | 3 | 4 | 5 | 6) => {
			editor?.chain().focus().toggleHeading({ level }).run();
		},
		[editor]
	);

	// Recursive render of outline items
	const renderItem = React.useCallback(
		(itemId: string, depth: number): React.ReactElement | null => {
			if (!outline?.items) return null;

			const item = outline.items.get(itemId);
			if (!item) return null;

			// Skip if beyond max depth
			if (depth > maxDepth) return null;

			const isActive = activeSectionId === item.id;
			const isCollapsed = collapsedSections.has(item.id);
			const isHoverTarget = hoverTarget?.targetId === item.id;

			// Render child items
			const childItems = item.children.map((childId) =>
				renderItem(childId, depth + 1)
			);

			return (
				<OutlineItem
					key={item.id}
					item={item}
					depth={depth}
					isActive={isActive}
					draggedItemId={draggedItemId}
					hoverTargetId={isHoverTarget ? item.id : null}
					isDropValid={isDropValid}
					onClick={handleSectionClick}
					onToggleCollapse={onToggleCollapse}
					onDragStart={enableDragDrop ? handleDragStart : undefined}
					onDragEnd={enableDragDrop && onDragEnd ? () => onDragEnd(false) : undefined}
					isDraggable={enableDragDrop}
					isCollapsed={isCollapsed}
				>
					{childItems.length > 0 && (
						<div className="transition-all duration-200 ease-in-out">
							{childItems}
						</div>
					)}
				</OutlineItem>
			);
		},
		[
			outline,
			activeSectionId,
			draggedItemId,
			hoverTarget,
			isDropValid,
			collapsedSections,
			maxDepth,
			handleSectionClick,
			onToggleCollapse,
			handleDragStart,
			onDragEnd,
			enableDragDrop,
		]
	);

	// Calculate total items for display
	const totalItems = React.useMemo(
		() => outline?.flat?.length ?? 0,
		[outline]
	);

	// Calculate section depth stats
	const depthStats = React.useMemo(() => {
		if (!outline?.flat) return null;
		const stats = new Map<number, number>();
		for (const item of outline.flat) {
			const count = stats.get(item.level) ?? 0;
			stats.set(item.level, count + 1);
		}
		return stats;
	}, [outline]);

	const hasHeadings = totalItems > 0;

	return (
		<div
			className={cn(
				"flex flex-col h-full border rounded-lg bg-card text-card-foreground",
				className
			)}
		>
			{/* Panel header */}
			<div className="flex items-center justify-between p-3 border-b bg-muted/50">
				<div className="flex items-center gap-2">
					<List className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
					<h3 className="font-semibold text-sm">{title}</h3>
					{!isLoading && totalItems > 0 && (
						<span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
							{totalItems}
						</span>
					)}
				</div>
				{onRefresh && (
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={onRefresh}
								className={cn(
									"p-1.5 rounded-sm text-muted-foreground transition-colors",
									"hover:bg-accent hover:text-accent-foreground",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									isLoading && "animate-spin"
								)}
								disabled={isLoading}
								aria-label="Refresh outline"
							>
								<RefreshCw className="h-4 w-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="bottom">Refresh outline</TooltipContent>
					</Tooltip>
				)}
			</div>

			{/* Panel content */}
			<div className="flex-1 overflow-y-auto p-2">
				{/* Loading state */}
				{isLoading && (
					<div className="space-y-1" role="status" aria-label="Loading outline">
						<OutlineItemSkeleton depth={0} />
						<OutlineItemSkeleton depth={1} />
						<OutlineItemSkeleton depth={1} />
						<OutlineItemSkeleton depth={2} />
						<OutlineItemSkeleton depth={0} />
						<OutlineItemSkeleton depth={1} />
					</div>
				)}

				{/* Enhanced Empty State */}
				{!isLoading && (!outline?.flat?.length) && (
					<div
						className="flex flex-col h-full"
						role="status"
					>
						<div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
							<div className="relative mb-4">
								<div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-xl" />
								<div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
									<span className="text-3xl font-bold text-white">#</span>
								</div>
							</div>
							
							<h4 className="text-sm font-semibold text-foreground mb-2">
								No headings yet
							</h4>
							<p className="text-xs text-muted-foreground mb-6 max-w-[200px] leading-relaxed">
								Add H1-H6 headings to structure your document. The outline will auto-populate as you type.
							</p>

							{/* Quick insert buttons */}
							{editor && (
								<div className="flex flex-col items-center gap-3">
									<div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
										Quick insert
									</div>
									<div className="flex items-center gap-2">
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() => insertHeading(1)}
												>
													<Heading1 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent side="bottom">Insert H1</TooltipContent>
										</Tooltip>
										
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() => insertHeading(2)}
												>
													<Heading2 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent side="bottom">Insert H2</TooltipContent>
										</Tooltip>
										
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() => insertHeading(3)}
												>
													<Heading3 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent side="bottom">Insert H3</TooltipContent>
										</Tooltip>
									</div>
									
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="text-xs text-muted-foreground hover:text-foreground"
												onClick={() => editor?.chain().focus().run()}
											>
												<Plus className="h-3 w-3 mr-1" />
												Start typing
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom">Focus editor</TooltipContent>
									</Tooltip>
								</div>
							)}

							{/* Error state */}
							{error && (
								<div className="mt-4 p-3 bg-destructive/10 rounded-lg">
									<p className="text-xs text-destructive">{error}</p>
									{onRefresh && (
										<button
											type="button"
											onClick={onRefresh}
											className="mt-2 text-xs text-primary hover:underline"
										>
											Try again
										</button>
									)}
								</div>
							)}
						</div>
					</div>
				)}

				{/* Outline items */}
				{!isLoading && outline?.roots && outline.roots.length > 0 && (
					<div
						className="space-y-0.5"
						role="tree"
						aria-label="Document outline"
					>
						{outline.roots.map((rootId) => renderItem(rootId, 0))}
					</div>
				)}
			</div>

			{/* Footer with stats */}
			{depthStats && depthStats.size > 0 && (
				<div className="border-t p-2 text-xs text-muted-foreground bg-muted/30">
					<div className="flex items-center gap-2 flex-wrap">
						{Array.from(depthStats.entries()).map(([level, count]) => (
							<span key={level} className="inline-flex items-center gap-1">
								<span
									className={cn(
										"h-2 w-2 rounded-full",
										level === 1 && "bg-primary",
										level === 2 && "bg-primary/70",
										level >= 3 && "bg-primary/40"
									)}
								/>
								<span>
									{count} H{level}
								</span>
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
});

OutlinePanel.displayName = "OutlinePanel";
