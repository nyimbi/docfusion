"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";
import type {
	OutlineItem,
	DocumentOutline,
} from "@/lib/editor/extensions/outline";
import type {
	DropPosition,
	DragMode,
} from "@/lib/editor/extensions/drag-drop";

/**
 * Drop zone indicator position
 */
export type DropZone =
	| { type: "before" | "after"; itemId: string }
	| { type: "inside"; itemId: string }
	| null;

/**
 * Drag context value
 */
export interface DragContextValue {
	/** Currently dragged item */
	draggedItem: OutlineItem | null;
	/** Current drop zone */
	dropZone: DropZone;
	/** Whether current drop is valid */
	isValidDrop: boolean;
	/** Start dragging an item */
	startDrag: (item: OutlineItem, mode: DragMode) => void;
	/** Update drop zone */
	setDropZone: (zone: DropZone, isValid: boolean) => void;
	/** End drag operation */
	endDrag: (dropped?: boolean) => void;
	/** Register a drop handler */
	registerDropHandler: (
		handler: (source: OutlineItem, target: DropZone) => boolean
	) => () => void;
	/** Check if drop is allowed */
	validateDrop: (source: OutlineItem, targetId: string) => boolean;
	/** Editor instance */
	editor: Editor | null;
	/** Document outline */
	outline: DocumentOutline | null;
}

/**
 * Props for DragDropProvider component
 */
export interface DragDropProviderProps {
	/** Child components */
	children: React.ReactNode;
	/** Tiptap editor instance */
	editor: Editor | null;
	/** Document outline */
	outline: DocumentOutline | null;
	/** Called when a drop is performed */
	onDrop?: (source: OutlineItem, target: DropZone) => boolean;
	/** Validate if drop is allowed */
	validateDrop?: (source: OutlineItem, targetId: string) => boolean;
	/** Called when drag starts */
	onDragStart?: (item: OutlineItem, mode: DragMode) => void;
	/** Called when drag ends */
	onDragEnd?: (success: boolean, item: OutlineItem | null) => void;
	/** Custom className */
	className?: string;
}

/**
 * Context for drag-drop state
 */
const DragContext = React.createContext<DragContextValue | null>(null);

/**
 * Hook to access drag-drop context
 */
export function useDragContext(): DragContextValue {
	const context = React.useContext(DragContext);
	if (!context) {
		throw new Error("useDragContext must be used within DragDropProvider");
	}
	return context;
}

/**
 * Safe hook that returns null if outside provider
 */
export function useDragContextSafe(): DragContextValue | null {
	return React.useContext(DragContext);
}

/**
 * Drag-and-drop context provider component.
 *
 * Manages the drag-drop state across all related components:
 * - Tracks currently dragged item
 * - Manages drop zones and validation
 * - Coordinates drop operations
 * - Provides visual feedback through CSS classes
 *
 * @example
 * <DragDropProvider
 *   editor={editor}
 *   outline={outline}
 *   onDrop={handleDrop}
 * >
 *   <OutlinePanel />
 *   <SectionReordering />
 * </DragDropProvider>
 */
export function DragDropProvider({
	children,
	editor,
	outline,
	onDrop,
	validateDrop,
	onDragStart,
	onDragEnd,
	className,
}: DragDropProviderProps): React.ReactElement {
	const [draggedItem, setDraggedItem] = React.useState<OutlineItem | null>(null);
	const [dropZone, setDropZone] = React.useState<DropZone>(null);
	const [isValidDrop, setIsValidDrop] = React.useState(true);
	const dropHandlersRef = React.useRef<Set<(source: OutlineItem, target: DropZone) => boolean>>(new Set());

	// Default validation: prevent dropping into a child of dragged item
	const defaultValidateDrop = React.useCallback(
		(source: OutlineItem, targetId: string): boolean => {
			if (!outline) return true;

			const isDescendant = (parentId: string, childId: string): boolean => {
				const parent = outline.items.get(childId);
				if (!parent) return false;
				if (parent.id === parentId) return true;
				if (parent.parentId) {
					return isDescendant(parentId, parent.parentId);
				}
				return false;
			};

			// Can't drop parent into its own descendant
			return !isDescendant(source.id, targetId);
		},
		[outline]
	);

	// Start drag operation
	const startDrag = React.useCallback(
		(item: OutlineItem, mode: DragMode) => {
			setDraggedItem(item);
			setDropZone(null);
			setIsValidDrop(true);
			onDragStart?.(item, mode);

			// Update editor storage
			if (editor) {
				const storage = (editor.storage as any).dragDrop;
				if (storage) {
					storage.isDragging = true;
					storage.draggedItem = item;
				}
			}
		},
		[editor, onDragStart]
	);

	// Update drop zone
	const handleSetDropZone = React.useCallback(
		(zone: DropZone, isValid: boolean) => {
			// Validate drop if custom validator provided
			if (zone && draggedItem) {
				const isAllowed = validateDrop
					? validateDrop(draggedItem, zone.itemId)
					: defaultValidateDrop(draggedItem, zone.itemId);
				setIsValidDrop(isAllowed && isValid);
			} else {
				setIsValidDrop(isValid);
			}
			setDropZone(zone);
		},
		[draggedItem, validateDrop, defaultValidateDrop]
	);

	// End drag operation
	const endDrag = React.useCallback(
		(dropped = false) => {
			const wasDraggedItem = draggedItem;
			setDraggedItem(null);
			setDropZone(null);
			setIsValidDrop(true);
			onDragEnd?.(dropped, wasDraggedItem);

			// Update editor storage
			if (editor) {
				const storage = (editor.storage as any).dragDrop;
				if (storage) {
					storage.isDragging = false;
					storage.draggedItem = null;
				}
			}
		},
		[draggedItem, editor, onDragEnd]
	);

	// Register drop handler
	const registerDropHandler = React.useCallback(
		(handler: (source: OutlineItem, target: DropZone) => boolean) => {
			dropHandlersRef.current.add(handler);
			return () => {
				dropHandlersRef.current.delete(handler);
			};
		},
		[]
	);

	// Context value
	const contextValue = React.useMemo<DragContextValue>(
		() => ({
			draggedItem,
			dropZone,
			isValidDrop,
			startDrag,
			setDropZone: handleSetDropZone,
			endDrag,
			registerDropHandler,
			validateDrop: validateDrop ?? defaultValidateDrop,
			editor,
			outline,
		}),
		[
			draggedItem,
			dropZone,
			isValidDrop,
			startDrag,
			handleSetDropZone,
			endDrag,
			registerDropHandler,
			validateDrop,
			defaultValidateDrop,
			editor,
			outline,
		]
	);

	// Global drag end listener to cleanup on cancelled drops
	React.useEffect(() => {
		if (!draggedItem) return;

		const handleDragEnd = () => {
			endDrag(false);
		};

		document.addEventListener("dragend", handleDragEnd);
		return () => {
			document.removeEventListener("dragend", handleDragEnd);
		};
	}, [draggedItem, endDrag]);

	// Prevent default on drag over to allow drops
	React.useEffect(() => {
		if (!draggedItem) return;

		const handleDragOver = (e: DragEvent) => {
			if (draggedItem) {
				e.preventDefault();
			}
		};

		document.addEventListener("dragover", handleDragOver);
		return () => {
			document.removeEventListener("dragover", handleDragOver);
		};
	}, [draggedItem]);

	return (
		<DragContext.Provider value={contextValue}>
			<div
				className={cn(
					"drag-drop-provider",
					draggedItem && "is-dragging",
					!isValidDrop && "invalid-drop",
					className
				)}
				data-dragging={draggedItem ? "true" : "false"}
			>
				{children}
			</div>
		</DragContext.Provider>
	);
}

/**
 * Drop target component for visual indicators
 */
export interface DropTargetProps {
	/** Item ID this target represents */
	itemId: string;
	/** Children to render inside */
	children: React.ReactNode;
	/** Accept drop: before, after, inside */
	acceptPosition?: ("before" | "after" | "inside")[];
	/** Custom className */
	className?: string;
}

/**
 * Component that renders drop targets around children
 */
export function DropTarget({
	itemId,
	children,
	acceptPosition = ["before", "after", "inside"],
	className,
}: DropTargetProps): React.ReactElement {
	const context = useDragContextSafe();

	if (!context) {
		return <>{children}</>;
	}

	const { draggedItem, dropZone, isValidDrop, setDropZone, validateDrop } = context;
	const isDraggedOver = dropZone?.itemId === itemId;

	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		if (!draggedItem || draggedItem.id === itemId) return;

		// Determine position based on cursor position
		const rect = e.currentTarget.getBoundingClientRect();
		const relativeY = e.clientY - rect.top;
		const threshold = rect.height * 0.25;

		let position: NonNullable<DropZone>["type"];
		if (acceptPosition.includes("inside") && relativeY > threshold && relativeY < rect.height - threshold) {
			position = "inside";
		} else if (relativeY < threshold && acceptPosition.includes("before")) {
			position = "before";
		} else if (acceptPosition.includes("after")) {
			position = "after";
		} else {
			position = acceptPosition[0];
		}

		const isValid = validateDrop(draggedItem, itemId);
		setDropZone({ type: position, itemId }, isValid);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		// Only clear if leaving to outside, not entering child
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setDropZone(null, true);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	return (
		<div
			className={cn(
				"drop-target relative transition-colors duration-150",
				isDraggedOver && isValidDrop && "ring-2 ring-primary/50 bg-primary/5",
				isDraggedOver && !isValidDrop && "ring-2 ring-destructive/50 bg-destructive/5",
				className
			)}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			data-drop-target={isDraggedOver ? "true" : "false"}
			data-drop-position={isDraggedOver ? dropZone?.type : undefined}
		>
			{/* Drop indicator lines */}
			{isDraggedOver && dropZone?.type === "before" && (
				<div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-primary rounded-full z-10" />
			)}
			{isDraggedOver && dropZone?.type === "after" && (
				<div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary rounded-full z-10" />
			)}
			{isDraggedOver && dropZone?.type === "inside" && (
				<div className="absolute inset-0 border-2 border-dashed border-primary rounded-md pointer-events-none" />
			)}

			{children}
		</div>
	);
}

/**
 * Drag handle component for initiating drags
 */
export interface DragHandleProps {
	/** Item to drag */
	item: OutlineItem;
	/** Drag children (usually an icon) */
	children?: React.ReactNode;
	/** Additional className */
	className?: string;
	/** Additional props */
	[key: string]: any;
}

/**
 * Drag handle that can be attached to any element
 */
export function DragHandle({
	item,
	children,
	className,
	...props
}: DragHandleProps): React.ReactElement {
	const context = useDragContext();

	const handleDragStart = (e: React.DragEvent) => {
		context.startDrag(item, "move");
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("application/x-outline-item", item.id);
	};

	const handleDragEnd = () => {
		context.endDrag(false);
	};

	return (
		<div
			className={cn(
				"drag-handle cursor-grab active:cursor-grabbing touch-none",
				className
			)}
			draggable
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			role="button"
			tabIndex={0}
			aria-label="Drag to reorder"
			{...props}
		>
			{children}
		</div>
	);
}
