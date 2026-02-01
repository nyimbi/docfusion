/**
 * Tiptap Extensions - DocFusion
 *
 * Custom Tiptap extensions for document editing features:
 * - Outline: Document structure parsing and navigation
 * - DragDrop: Section reordering via drag-and-drop
 */

// Outline Extension
export {
	Outline,
	outlinePluginKey,
	getEditorOutline,
	navigateToHeading,
	toggleSectionCollapse,
	getSectionRange,
	selectSection,
	type HeadingLevel,
	type OutlineItem,
	type DocumentOutline,
	type OutlineOptions,
} from "./outline";

// Drag-Drop Extension
export {
	DragDrop,
	dragDropPluginKey,
	moveSectionToPosition,
	getDragState,
	setDragState,
	type DropPosition,
	type DragState,
	type DragMode,
	type DragDropOptions,
} from "./drag-drop";
