"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, GripVertical } from "lucide-react";
import type { OutlineItem as OutlineItemType } from "@/lib/editor/extensions/outline";

/**
 * Props for OutlinemItem component
 */
export interface OutlineItemProps {
	/** The outline item data */
	item: OutlineItemType;
	/** Child items */
	children?: React.ReactNode;
	/** Current nesting depth */
	depth?: number;
	/** Whether this item is currently active/selected */
	isActive?: boolean;
	/** Currently dragged item ID */
	draggedItemId?: string | null;
	/** Hover target item ID */
	hoverTargetId?: string | null;
	/** Whether drag operation is valid */
	isDropValid?: boolean;
	/** Callback when item is clicked */
	onClick?: (item: OutlineItemType) => void;
	/** Callback when collapse state changes */
	onToggleCollapse?: (item: OutlineItemType, collapsed: boolean) => void;
	/** Callback when drag starts */
	onDragStart?: (item: OutlineItemType, event: React.DragEvent) => void;
	/** Callback when drag ends */
	onDragEnd?: () => void;
	/** Callback to show context menu */
	onContextMenu?: (
		item: OutlineItemType,
		event: React.MouseEvent
	) => void;
	/** Custom className */
	className?: string;
	/** Whether drag-and-drop is enabled */
	isDraggable?: boolean;
	/** Whether this section is collapsed */
	isCollapsed?: boolean;
}

/**
 * Individual outline item with depth indicator and drag support.
 *
 * Features:
 * - Visual indentation based on depth
 * - Expand/collapse toggle for nested sections
 * - Drag handle for reordering
 * - Active state highlighting
 * - Drop target indicators
 *
 * @example
 * <OutlineItem
 *   item={section}
 *   depth={1}
 *   isActive={true}
 *   onClick={() => navigateToSection(section)}
 *   onToggleCollapse={() => toggleSection(section)}
 * />
 */
export const OutlineItem = React.memo(function OutlineItem({
	item,
	children,
	depth = 0,
	isActive = false,
	draggedItemId,
	hoverTargetId,
	isDropValid = true,
	onClick,
	onToggleCollapse,
	onDragStart,
	onDragEnd,
	onContextMenu,
	className,
	isDraggable = false,
	isCollapsed = false,
}: OutlineItemProps) {
	const itemRef = React.useRef<HTMLDivElement>(null);
	const hasChildren = item.children && item.children.length > 0;
	const isDragged = draggedItemId === item.id;
	const isHoverTarget = hoverTargetId === item.id;

	// Handle click with proper event handling
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();
			onClick?.(item);
		},
		[onClick, item]
	);

	// Handle toggle with proper event handling
	const handleToggle = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();
			onToggleCollapse?.(item, !isCollapsed);
		},
		[onToggleCollapse, item, isCollapsed]
	);

	// Handle context menu
	const handleContextMenu = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();
			onContextMenu?.(item, event);
		},
		[onContextMenu, item]
	);

	// Handle drag start
	const handleDragStart = React.useCallback(
		(event: React.DragEvent<HTMLDivElement>) => {
			if (!isDraggable) {
				event.preventDefault();
				return;
			}
			onDragStart?.(item, event);
		},
		[isDraggable, onDragStart, item]
	);

	// Calculate indentation based on depth
	const indentation = React.useMemo(
		() => ({
			paddingLeft: `${(depth * 12) + 8}px`,
		}),
		[depth]
	);

	// Item type indicator based on level
	const levelIcon = React.useMemo(() => {
		switch (item.level) {
			case 1:
				return <span className="text-xs font-bold text-primary" aria-hidden="true">H1</span>;
			case 2:
				return <span className="text-xs font-semibold text-muted-foreground" aria-hidden="true">H2</span>;
			case 3:
				return <span className="text-xs text-muted-foreground" aria-hidden="true">H3</span>;
			default:
				return <span className="text-xs text-muted-foreground/60" aria-hidden="true">H{item.level}</span>;
		}
	}, [item.level]);

	// Drop indicator styles
	const dropStyles = React.useMemo(() => {
		if (!isHoverTarget) return "";
		return isDropValid
			? "ring-2 ring-primary ring-inset bg-primary/5"
			: "ring-2 ring-destructive ring-inset bg-destructive/5";
	}, [isHoverTarget, isDropValid]);

	return (
		<div
			ref={itemRef}
			className="outline-item-group"
			role="group"
			aria-label={`Section: ${item.text}`}
		>
			<div
				className={cn(
					"group relative flex items-center gap-1 rounded-sm py-1.5 pr-2 text-sm transition-colors",
					"hover:bg-accent hover:text-accent-foreground cursor-pointer",
					isActive && "bg-primary/10 text-primary font-medium",
					isDragged && "opacity-50 cursor-grabbing",
					dropStyles,
					className
				)}
				style={indentation}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				draggable={isDraggable}
				onDragStart={handleDragStart}
				onDragEnd={onDragEnd}
				role="treeitem"
				aria-expanded={hasChildren ? !isCollapsed : undefined}
				aria-selected={isActive}
				aria-level={item.level}
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
					}
				}}
			>
				{/* Collapse toggle button */}
				{hasChildren ? (
					<button
						type="button"
						onClick={handleToggle}
						className={cn(
							"flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
							"hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							"transition-transform duration-200"
						)}
						aria-label={isCollapsed ? "Expand section" : "Collapse section"}
					>
						<ChevronRight
							className={cn(
								"h-3.5 w-3.5 transition-transform duration-200",
								!isCollapsed && "rotate-90"
							)}
						/>
					</button>
				) : (
					// Spacer for alignment
					<span className="flex h-5 w-5 shrink-0 items-center justify-center">
						{levelIcon}
					</span>
				)}

				{/* Drag handle (visible on hover or when active) */}
				{isDraggable && (
					<GripVertical
						className={cn(
							"h-4 w-4 shrink-0 text-muted-foreground/50 cursor-grab",
							"opacity-0 group-hover:opacity-100 transition-opacity",
							isActive && "opacity-100",
							isDragged && "cursor-grabbing"
						)}
						aria-hidden="true"
					/>
				)}

				{/* Section status dot */}
				{item.wordCount !== undefined && (
					<span
						className={cn(
							"h-1.5 w-1.5 rounded-full shrink-0",
							item.wordCount === 0 && "bg-muted-foreground/30",
							item.wordCount > 0 && item.wordCount < 50 && "bg-amber-400",
							item.wordCount >= 50 && "bg-green-400"
						)}
						title={
							item.wordCount === 0
								? "Empty section"
								: item.wordCount < 50
									? "Draft"
									: "Substantial content"
						}
					/>
				)}

				{/* Section title */}
				<span 
					className={cn(
						"line-clamp-2 flex-1",
						isActive && "font-medium"
					)}
					title={item.text}>
					{item.slug || item.text}
				</span>

				{/* Word count badge */}
				{item.wordCount !== undefined && item.wordCount > 0 && (
					<span className="text-[10px] tabular-nums text-muted-foreground/60 ml-1">
						{item.wordCount}w
					</span>
				)}

				{/* Content count indicator (if has children) */}
				{hasChildren && (
					<span className="text-xs text-muted-foreground/70">
						{item.children.length}
					</span>
				)}
			</div>

			{/* Nested children (only rendered if not collapsed) */}
			{!isCollapsed && children && (
				<div 
					className="outline-children"
					role="group"
					aria-label={`Subsections of ${item.text}`}
				>
					{children}
				</div>
			)}
		</div>
	);
});

OutlineItem.displayName = "OutlineItem";

/**
 * Skeleton loading state for outline item
 */
export function OutlineItemSkeleton({ depth = 0 }: { depth?: number }): React.ReactElement {
	return (
		<div
			className="flex items-center gap-2 py-1.5 pr-2"
			style={{ paddingLeft: `${(depth * 12) + 8}px` }}
		>
			<span className="h-4 w-4 rounded bg-muted animate-pulse" />
			<span className="h-4 flex-1 rounded bg-muted animate-pulse" />
		</div>
	);
}
