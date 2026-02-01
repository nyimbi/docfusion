"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import type {
	OutlineItem,
	DocumentOutline,
	OutlineOptions,
} from "@/lib/editor/extensions/outline";
import type { DropPosition, DragMode } from "@/lib/editor/extensions/drag-drop";
import {
	getEditorOutline,
	navigateToHeading,
	toggleSectionCollapse,
	moveSectionToPosition,
} from "@/lib/editor/extensions";

/**
 * Return type of useOutline hook
 */
export interface UseOutlineReturn {
	/** Current document outline */
	outline: DocumentOutline | null;
	/** Currently selected/focused section ID */
	activeSectionId: string | null;
	/** Set of collapsed section IDs */
	collapsedSections: Set<string>;
	/** Currently dragged item */
	draggedItem: OutlineItem | null;
	/** Current hover target */
	hoverTarget: DropPosition | null;
	/** Whether current drop is valid */
	isDropValid: boolean;
	/** Navigate to a section */
	navigateToSection: (item: OutlineItem) => void;
	/** Toggle section collapse */
	toggleSection: (item: OutlineItem) => void;
	/** Expand all sections */
	expandAll: () => void;
	/** Collapse all sections */
	collapseAll: () => void;
	/** Check if any sections are collapsed */
	hasCollapsedSections: boolean;
	/** Start dragging a section */
	startDrag: (item: OutlineItem, mode?: DragMode) => void;
	/** End drag operation */
	endDrag: (success?: boolean) => void;
	/** Handle drop operation */
	handleDrop: (source: OutlineItem, target: DropPosition) => boolean;
	/** Set hover target */
	setHoverTarget: (target: DropPosition | null) => void;
	/** Refresh outline from editor */
	refreshOutline: () => void;
}

/**
 * Options for useOutline hook
 */
export interface UseOutlineOptions {
	/** Tiptap editor instance */
	editor: Editor | null;
	/** Maximum depth to track */
	maxDepth?: number;
	/** Callback when outline changes */
	onOutlineChange?: (outline: DocumentOutline) => void;
	/** Callback when section is navigated */
	onSectionNavigate?: (item: OutlineItem) => void;
	/** Callback when sections are collapsed/expanded */
	onSectionsCollapse?: (collapsedIds: Set<string>) => void;
	/** Callback when section is moved */
	onSectionMove?: (sourceId: string, targetId: string, position: DropPosition) => void;
	/** Initial collapsed sections */
	initialCollapsedSections?: Set<string>;
	/** Whether to auto-save collapsed state to localStorage */
	saveCollapsedState?: boolean;
}

/**
 * Hook for managing document outline with drag-and-drop support.
 *
 * Features:
 * - Reactive outline updates from editor
 * - Section navigation with focus handling
 * - Expand/collapse state management
 * - Drag-and-drop orchestration
 * - Local storage persistence for collapsed state
 *
 * @example
 * const {
 *   outline,
 *   activeSectionId,
 *   navigateToSection,
 *   toggleSection,
 * } = useOutline({
 *   editor,
 *   onOutlineChange: (outline) => console.log('Outline updated:', outline),
 * });
 */
export function useOutline(options: UseOutlineOptions): UseOutlineReturn {
	const {
		editor,
		maxDepth = 6,
		onOutlineChange,
		onSectionNavigate,
		onSectionsCollapse,
		onSectionMove,
		initialCollapsedSections,
		saveCollapsedState = false,
	} = options;

	// Storage key for localStorage
	const storageKey = React.useMemo(
		() => editor ? "docfusion-outline-collapsed-default" : null,
		[editor]
	);

	// Load initial collapsed state from localStorage if enabled
	const initialCollapsed = React.useMemo((): Set<string> => {
		if (initialCollapsedSections) return initialCollapsedSections;
		if (saveCollapsedState && storageKey && typeof window !== "undefined") {
			try {
				const stored = localStorage.getItem(storageKey);
				if (stored) {
					return new Set<string>(JSON.parse(stored) as string[]);
				}
			} catch (e) {
				console.warn("Failed to load collapsed sections from localStorage", e);
			}
		}
		return new Set<string>();
	}, [initialCollapsedSections, saveCollapsedState, storageKey]);

	// State
	const [outline, setOutline] = React.useState<DocumentOutline | null>(null);
	const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);
	const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(initialCollapsed);
	const [draggedItem, setDraggedItem] = React.useState<OutlineItem | null>(null);
	const [hoverTarget, setHoverTarget] = React.useState<DropPosition | null>(null);
	const [isDropValid, setIsDropValid] = React.useState(true);
	const [isReady, setIsReady] = React.useState(false);

	// Persist collapsed state to localStorage
	React.useEffect(() => {
		if (saveCollapsedState && storageKey && isReady && typeof window !== "undefined") {
			try {
				localStorage.setItem(storageKey, JSON.stringify(Array.from(collapsedSections)));
			} catch (e) {
				console.warn("Failed to save collapsed sections to localStorage", e);
			}
		}
	}, [collapsedSections, saveCollapsedState, storageKey, isReady]);

	// Update outline from editor
	const refreshOutline = React.useCallback(() => {
		if (!editor) return;

		const currentOutline = getEditorOutline(editor);
		setOutline(currentOutline);
		onOutlineChange?.(currentOutline);
	}, [editor, onOutlineChange]);

	// Initialize and listen to editor changes
	React.useEffect(() => {
		if (!editor) return;

		// Initial load
		const initialOutline = getEditorOutline(editor);
		setOutline(initialOutline);
		onOutlineChange?.(initialOutline);
		setIsReady(true);

		// Watch for outline changes
		const updateOutline = ({ editor: e }: { editor: Editor }) => {
			const newOutline = getEditorOutline(e);
			setOutline(newOutline);
			onOutlineChange?.(newOutline);
		};

		editor.on("update", updateOutline);

		// Listen to cursor position for active section
		const updateActiveSection = ({ editor: e }: { editor: Editor }) => {
			const { selection } = e.state;
			const current = getEditorOutline(e);

			// Find section containing cursor
			let activeId: string | null = null;
			if (current?.flat && Array.isArray(current.flat)) {
				for (const item of current.flat) {
					if (item.pos <= selection.from) {
						activeId = item.id;
					} else {
						break;
					}
				}
			}

			setActiveSectionId(activeId);
		};

		editor.on("selectionUpdate", updateActiveSection);

		return () => {
			editor.off("update", updateOutline);
			editor.off("selectionUpdate", updateActiveSection);
		};
	}, [editor, onOutlineChange]);

	// Navigate to a section
	const navigateToSection = React.useCallback(
		(item: OutlineItem) => {
			if (!editor) return;

			setActiveSectionId(item.id);
			navigateToHeading(editor, item);
			onSectionNavigate?.(item);
		},
		[editor, onSectionNavigate]
	);

	// Toggle section collapse
	const toggleSection = React.useCallback(
		(item: OutlineItem) => {
			setCollapsedSections((prev) => {
				const next = new Set(prev);
				if (next.has(item.id)) {
					next.delete(item.id);
				} else {
					next.add(item.id);
				}
				onSectionsCollapse?.(next);
				return next;
			});
		},
		[onSectionsCollapse]
	);

	// Expand all sections
	const expandAll = React.useCallback(() => {
		setCollapsedSections((prev) => {
			const next = new Set<string>();
			onSectionsCollapse?.(next);
			return next;
		});
	}, [onSectionsCollapse]);

	// Collapse all sections (respecting maxDepth)
	const collapseAll = React.useCallback(() => {
		if (!outline) return;

		const next = new Set<string>();
		if (outline?.flat && Array.isArray(outline.flat)) {
			for (const item of outline.flat) {
				if (item.children.length > 0 && item.level < maxDepth) {
					next.add(item.id);
				}
			}
		}
		setCollapsedSections(next);
		onSectionsCollapse?.(next);
	}, [outline, maxDepth, onSectionsCollapse]);

	// Check if any sections are collapsed
	const hasCollapsedSections = React.useMemo(
		() => collapsedSections.size > 0,
		[collapsedSections]
	);

	// Drag operations
	const startDrag = React.useCallback(
		(item: OutlineItem, mode: DragMode = "move") => {
			setDraggedItem(item);
			setHoverTarget(null);
			setIsDropValid(true);

			// Update editor state
			if (editor) {
				const storage = editor.storage?.dragDrop;
				if (storage) {
					storage.isDragging = true;
					storage.draggedItem = item;
				}
			}
		},
		[editor]
	);

	const endDrag = React.useCallback(
		(success = false) => {
			setDraggedItem(null);
			setHoverTarget(null);
			setIsDropValid(true);

			// Update editor state
			if (editor) {
				const storage = editor.storage?.dragDrop;
				if (storage) {
					storage.isDragging = false;
					storage.draggedItem = null;
				}
			}
		},
		[editor]
	);

	// Handle drop operation
	const handleDrop = React.useCallback(
		(source: OutlineItem, target: DropPosition): boolean => {
			if (!editor) return false;

			// Validate - prevent dropping into own children
			const isDescendant = (parentId: string, targetId: string): boolean => {
				if (!outline) return false;
				const targetItem = outline.items.get(targetId);
				if (!targetItem) return false;
				if (targetItem.parentId === parentId) return true;
				if (targetItem.parentId) {
					return isDescendant(parentId, targetItem.parentId);
				}
				return false;
			};

			if (isDescendant(source.id, target.targetId)) {
				console.warn("Cannot drop a section into its own children");
				return false;
			}

			// Perform the move
			const success = moveSectionToPosition(
				editor,
				source,
				target.pos,
				target.type
			);

			if (success) {
				onSectionMove?.(source.id, target.targetId, target);
				refreshOutline();
			}

			endDrag(success);
			return success;
		},
		[editor, outline, onSectionMove, refreshOutline, endDrag]
	);

	// Update hover target (for visual feedback)
	const updateHoverTarget = React.useCallback(
		(target: DropPosition | null) => {
			setHoverTarget(target);

			// Validate drop target
			if (target && draggedItem && outline) {
				// Check if dropping into own descendants
				const isDescendant = (parentId: string, descId: string): boolean => {
					const item = outline.items.get(descId);
					if (!item) return false;
					if (item.parentId === parentId) return true;
					if (item.parentId) return isDescendant(parentId, item.parentId);
					return false;
				};

				const valid = !isDescendant(draggedItem.id, target.targetId);
				setIsDropValid(valid);
			} else {
				setIsDropValid(true);
			}
		},
		[draggedItem, outline]
	);

	return {
		outline,
		activeSectionId,
		collapsedSections,
		draggedItem,
		hoverTarget,
		isDropValid,
		navigateToSection,
		toggleSection,
		expandAll,
		collapseAll,
		hasCollapsedSections,
		startDrag,
		endDrag,
		handleDrop,
		setHoverTarget: updateHoverTarget,
		refreshOutline,
	};
}

export default useOutline;
