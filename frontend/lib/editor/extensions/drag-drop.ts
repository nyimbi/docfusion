/**
 * Drag-and-Drop Extension for Tiptap
 *
 * Enables section reordering via drag-and-drop for document headings.
 * Supports:
 * - Dragging headings to reorder sections
 * - Visual drop indicators
 * - Nested section handling
 * - Structure integrity validation
 */

import { Extension, type Editor } from "@tiptap/core";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { type OutlineItem } from "./outline";

/**
 * Position for drop indicator
 */
export interface DropPosition {
	/** Position in document */
	pos: number;
	/** Type of drop target */
	type: "before" | "after" | "inside";
	/** Target item ID */
	targetId: string;
}

/**
 * Drag state
 */
export interface DragState {
	/** Currently dragging item */
	draggingItem: OutlineItem | null;
	/** Current drop target */
	dropTarget: DropPosition | null;
	/** Whether drag is valid */
	isValid: boolean;
}

/**
 * Valid drag modes
 */
export type DragMode = "move" | "copy" | "promote" | "demote";

/**
 * Options for the DragDrop extension
 */
export interface DragDropOptions {
	/**
	 * Called when a drag operation starts
	 */
	onDragStart?: (item: OutlineItem, mode: DragMode) => void;
	/**
	 * Called when drag ends (success or cancel)
	 */
	onDragEnd?: (success: boolean) => void;
	/**
	 * Called when item is dropped
	 */
	onDrop?: (source: OutlineItem, target: DropPosition) => boolean;
	/**
	 * Validate if a drop is allowed
	 */
	validateDrop?: (source: OutlineItem, target: OutlineItem) => boolean;
	/**
	 * Visual indicator color
	 * @default "#3b82f6"
	 */
	indicatorColor: string;
	/**
	 * Whether to allow nested drops
	 * @default true
	 */
	allowNesting: boolean;
	/**
	 * Minimum level for dragging (can't drag higher level)
	 * @default 1
	 */
	minDragLevel: number;
}

/**
 * Plugin key for drag-drop
 */
export const dragDropPluginKey = new PluginKey<DragDropPluginState>("dragDrop");

/**
 * Plugin state
 */
interface DragDropPluginState {
	decorations: DecorationSet;
	dragState: DragState;
}

/**
 * Default validate drop - prevent dropping parent into child
 */
function defaultValidateDrop(
	source: OutlineItem,
	target: OutlineItem
): boolean {
	// Can't drop a parent into its own children
	let current: OutlineItem | undefined = target;
	while (current) {
		if (current.id === source.id) {
			return false;
		}
		current =
			current.parentId !== null
				? { id: current.parentId } as OutlineItem
				: undefined;
	}
	return true;
}

/**
 * Create drop indicator decoration
 */
function createDropIndicator(
	pos: number,
	type: "before" | "after" | "inside",
	color: string
): Decoration {
	const element = document.createElement("div");
	element.className = `drop-indicator drop-indicator-${type}`;
	
	const baseStyles = `
		position: absolute;
		left: 0;
		right: 0;
		pointer-events: none;
		z-index: 100;
		transition: all 0.15s ease;
	`;

	switch (type) {
		case "before":
		case "after":
			element.style.cssText = `
				${baseStyles}
				height: 3px;
				background: ${color};
				box-shadow: 0 0 0 2px ${color}20;
				border-radius: 2px;
			`;
			break;
		case "inside":
			element.style.cssText = `
				${baseStyles}
				border: 2px dashed ${color};
				border-radius: 4px;
				background: ${color}10;
				min-height: 2em;
			`;
			break;
	}

	return Decoration.widget(pos, () => element, {
		side: type === "before" ? -1 : 1,
		key: `drop-indicator-${type}-${pos}`,
	});
}

/**
 * Get drop position from mouse event
 */
function getDropPosition(
	event: DragEvent,
	editor: Editor,
	options: DragDropOptions
): DropPosition | null {
	const view = editor.view;
	const coords = { left: event.clientX, top: event.clientY };
	const pos = view.posAtCoords(coords);

	if (!pos) return null;

	// Find nearest heading
	let nodePos = pos.pos;
	let node: ProseMirrorNode | null = null;
	let nodeStart = 0;

	view.state.doc.nodesBetween(
		Math.max(0, nodePos - 100),
		Math.min(view.state.doc.content.size, nodePos + 100),
		(n, p) => {
			if (n.type.name === "heading") {
				node = n;
				nodeStart = p;
				return false;
			}
			return true;
		}
	);

	if (!node) return null;

	const dom = view.nodeDOM(nodeStart) as HTMLElement | null;
	if (!dom) return null;

	const rect = dom.getBoundingClientRect();
	const midpoint = rect.top + rect.height / 2;

	// Determine insert position based on mouse Y
	let type: DropPosition["type"] = "before";
	if (event.clientY > midpoint + 10) {
		type = "after";
	} else if (
		event.clientY > midpoint - 10 &&
		event.clientY < midpoint + 10 &&
		options.allowNesting
	) {
		type = "inside";
	}

	return {
		pos: nodeStart,
		type,
		targetId: (node as ProseMirrorNode).attrs.id || `heading-${nodeStart}`,
	};
}

/**
 * Find the section range (heading + content until next same/higher level heading)
 */
function findSectionRange(
	doc: ProseMirrorNode,
	startPos: number
): { from: number; to: number } | null {
	const startNode = doc.nodeAt(startPos);
	if (!startNode || startNode.type.name !== "heading") return null;

	const startLevel: number = startNode.attrs.level;
	let endPos = startPos + startNode.nodeSize;

	// Find the end of this section
	doc.nodesBetween(startPos + startNode.nodeSize, doc.content.size, (node, pos) => {
		if (node.type.name === "heading") {
			const level = node.attrs.level;
			if (level <= startLevel) {
				return false; // Stop at same or higher level
			}
		}
		endPos = pos + node.nodeSize;
		return true;
	});

	return { from: startPos, to: endPos };
}

/**
 * Move a section from one position to another
 */
function moveSection(
	editor: Editor,
	from: number,
	to: number,
	mode: "before" | "after" | "inside"
): boolean {
	const { state, dispatch } = editor.view;
	const { tr } = state;

	// Find section to move
	const sectionRange = findSectionRange(state.doc, from);
	if (!sectionRange) return false;

	const { from: sectionFrom, to: sectionTo } = sectionRange;

	// Extract the content
	const slice = state.doc.slice(sectionFrom, sectionTo);

	// Calculate insert position
	let insertPos = to;
	if (mode === "after") {
		const targetNode = state.doc.nodeAt(to);
		if (targetNode) {
			insertPos = to + targetNode.nodeSize;
		}
	}

	// Adjust for content that shifts
	const deleteOffset = insertPos > sectionFrom ? -(sectionTo - sectionFrom) : 0;

	// Perform the move
	tr.delete(sectionFrom, sectionTo);
	tr.insert(insertPos + deleteOffset, slice.content);

	dispatch(tr);
	return true;
}

/**
 * Drag-and-Drop Extension for Tiptap
 *
 * @example
 * const editor = new Editor({
 *   extensions: [
 *     StarterKit,
 *     DragDrop.configure({
 *       onDrop: (source, target) => {
 *         console.log(`Moved ${source.text} to ${target.pos}`);
 *         return true;
 *       },
 *     }),
 *   ],
 * });
 */
export const DragDrop = Extension.create<DragDropOptions>({
	name: "dragDrop",

	addOptions() {
		return {
			indicatorColor: "#3b82f6",
			allowNesting: true,
			minDragLevel: 1,
		};
	},

	addStorage() {
		return {
			isDragging: false,
			draggedItem: null as OutlineItem | null,
			canDropAt: (pos: number): boolean => {
				// Check if position is valid for drop
				return true;
			},
		};
	},

	addProseMirrorPlugins() {
		const editor = this.editor;
		const options = this.options;
		const storage = this.storage;

		const plugin = new Plugin<DragDropPluginState>({
			key: dragDropPluginKey,

			state: {
				init() {
					return {
						decorations: DecorationSet.empty,
						dragState: {
							draggingItem: null,
							dropTarget: null,
							isValid: false,
						},
					};
				},

				apply(tr, value) {
					if (!tr.getMeta(dragDropPluginKey)) {
						return {
							decorations: value.decorations.map(tr.mapping, tr.doc),
							dragState: value.dragState,
						};
					}

					const meta = tr.getMeta(dragDropPluginKey) as Partial<DragState>;
					const dragState = { ...value.dragState, ...meta };

					// Update decorations based on drag state
					const decorations: Decoration[] = [];
					if (dragState.dropTarget) {
						decorations.push(
							createDropIndicator(
								dragState.dropTarget.pos,
								dragState.dropTarget.type,
								options.indicatorColor
							)
						);
					}

					return {
						decorations: DecorationSet.create(tr.doc, decorations),
						dragState,
					};
				},
			},

			props: {
				decorations(state) {
					return this.getState(state)?.decorations ?? DecorationSet.empty;
				},

				handleDOMEvents: {
					// Handle drag start on headings
					dragstart: (view, event) => {
						const target = event.target as HTMLElement;
						const headingEl = target.closest("[data-node-type='heading']");

						if (!headingEl) return false;

						// Get the position and node
						const pos = view.posAtDOM(headingEl as Node, 0);
						const node = view.state.doc.nodeAt(pos);

						if (!node || node.type.name !== "heading") return false;

						// Check min level
						const level = node.attrs.level as number;
						if (level < options.minDragLevel) {
							event.preventDefault();
							return true;
						}

						const item: OutlineItem = {
							id: node.attrs.id || `heading-${pos}`,
							text: node.textContent,
							level: level as 1 | 2 | 3 | 4 | 5 | 6,
							pos,
							size: node.nodeSize,
							parentId: null,
							children: [],
							collapsed: false,
							slug: "",
						};

						// Set drag data
						event.dataTransfer?.setData(
							"application/x-tiptap-heading",
							JSON.stringify(item)
						);
						event.dataTransfer!.effectAllowed = "move";

						// Update state
						storage.isDragging = true;
						storage.draggedItem = item;
						options.onDragStart?.(item, "move");

						// Apply to plugin state
						const tr = view.state.tr.setMeta(dragDropPluginKey, {
							draggingItem: item,
						});
						view.dispatch(tr);

						return false;
					},

					dragover: (view, event) => {
						if (!storage.isDragging) return false;

						event.preventDefault();

						const dropPos = getDropPosition(event, editor, options);
						if (!dropPos) return false;

						// Validate drop
						let isValid = true;
						if (storage.draggedItem && options.validateDrop) {
							const targetNode = view.state.doc.nodeAt(dropPos.pos);
							if (targetNode) {
								const target: OutlineItem = {
									id: targetNode.attrs.id || `heading-${dropPos.pos}`,
									text: targetNode.textContent,
									level: targetNode.attrs.level,
									pos: dropPos.pos,
									size: targetNode.nodeSize,
									parentId: null,
									children: [],
									collapsed: false,
									slug: "",
								};
								isValid = options.validateDrop(storage.draggedItem, target);
							}
						}

						// Update decorations
						const tr = view.state.tr.setMeta(dragDropPluginKey, {
							dropTarget: dropPos,
							isValid,
						});
						view.dispatch(tr);

						return true;
					},

					drop: (view, event) => {
						if (!storage.isDragging) return false;

						event.preventDefault();

						const dropPos = getDropPosition(event, editor, options);
						const draggedItem = storage.draggedItem;

						// Reset state
						storage.isDragging = false;
						storage.draggedItem = null;

						// Clear decorations
						const tr = view.state.tr.setMeta(dragDropPluginKey, {
							draggingItem: null,
							dropTarget: null,
							isValid: false,
						});
						view.dispatch(tr);

						// Execute drop
						if (draggedItem && dropPos) {
							const success = options.onDrop?.(draggedItem, dropPos) ?? false;
							
							if (!success) {
								// Try default move operation
								moveSection(editor, draggedItem.pos, dropPos.pos, dropPos.type);
							}

							options.onDragEnd?.(true);
						} else {
							options.onDragEnd?.(false);
						}

						return true;
					},

					dragend: () => {
						storage.isDragging = false;
						storage.draggedItem = null;
						options.onDragEnd?.(false);
						return false;
					},
				},
			},
		});

		return [plugin];
	},
});

/**
 * Move a section programmatically
 */
export function moveSectionToPosition(
	editor: Editor,
	item: OutlineItem,
	targetPos: number,
	mode: "before" | "after" | "inside" = "after"
): boolean {
	return moveSection(editor, item.pos, targetPos, mode);
}

/**
 * Get current drag state from editor
 */
export function getDragState(editor: Editor): DragState | null {
	const pluginState = dragDropPluginKey.getState(editor.state);
	return pluginState?.dragState ?? null;
}

/**
 * Set drag state manually (for custom drag handles)
 */
export function setDragState(editor: Editor, state: Partial<DragState>): void {
	const tr = editor.state.tr.setMeta(dragDropPluginKey, state);
	editor.view.dispatch(tr);
}

export default DragDrop;
