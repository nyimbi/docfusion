/**
 * Outline Extension for Tiptap
 *
 * Parses document structure (headings, sections) and provides:
 * - Real-time outline structure extraction
 * - Section metadata tracking
 * - Heading change detection for outline updates
 */

import { Extension, type Editor } from "@tiptap/core";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Heading level (1-6)
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Single outline item representing a document section
 */
export interface OutlineItem {
	/** Unique identifier for the heading */
	id: string;
	/** Heading text content */
	text: string;
	/** Heading level (1-6) */
	level: HeadingLevel;
	/** Position in the document (from start) */
	pos: number;
	/** Node size in the document */
	size: number;
	/** Parent item ID for nested structure (null if root) */
	parentId: string | null;
	/** Child item IDs */
	children: string[];
	/** Whether this section is collapsed */
	collapsed: boolean;
	/** Generated slug for URL/anchor linking */
	slug: string;
	/** Word count for this section (excluding subsections) */
	wordCount?: number;
}

/**
 * Document outline structure
 */
export interface DocumentOutline {
	/** All outline items indexed by ID */
	items: Map<string, OutlineItem>;
	/** Root item IDs (top-level headings) */
	roots: string[];
	/** Flat ordered list of all items */
	flat: OutlineItem[];
}

/**
 * Options for the Outline extension
 */
export interface OutlineOptions {
	/**
	 * Maximum heading level to include in outline (1-6)
	 * @default 6
	 */
	maxDepth: HeadingLevel;
	/**
	 * Minimum heading level to include in outline (1-6)
	 * @default 1
	 */
	minDepth: HeadingLevel;
	/**
	 * Whether to automatically assign IDs to headings
	 * @default true
	 */
	autoAssignIds: boolean;
	/**
	 * Callback when outline changes
	 */
	onOutlineChange?: (outline: DocumentOutline) => void;
	/**
	 * Callback when user clicks on a heading (for navigation)
	 */
	onHeadingClick?: (item: OutlineItem) => void;
	/**
	 * Whether to show section numbers (1.1, 1.2, etc.)
	 * @default false
	 */
	showSectionNumbers: boolean;
}

/**
 * Plugin key for the outline plugin
 */
export const outlinePluginKey = new PluginKey<OutlinePluginState>("outline");

/**
 * State tracked by the outline plugin
 */
interface OutlinePluginState {
	outline: DocumentOutline;
	decorations: DecorationSet;
}

/**
 * Generate a slug from heading text
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-")
		.substring(0, 50);
}

/**
 * Generate unique ID for a heading
 */
function generateHeadingId(text: string, pos: number): string {
	const slug = slugify(text);
	const hash = Math.abs(pos * 31).toString(36).substring(0, 6);
	return slug ? `${slug}-${hash}` : `section-${hash}`;
}

/**
 * Extract outline from the document
 */
function extractOutline(
	doc: ProseMirrorNode,
	options: OutlineOptions
): DocumentOutline {
	const items = new Map<string, OutlineItem>();
	const roots: string[] = [];
	const flat: OutlineItem[] = [];

	// Track parent hierarchy
	const parentStack: { id: string; level: number }[] = [];

	doc.descendants((node, pos) => {
		if (node.type.name === "heading") {
			const level = node.attrs.level as HeadingLevel;

			// Skip if outside depth range
			if (level < options.minDepth || level > options.maxDepth) {
				return true;
			}

			const text = node.textContent || "Untitled";
			const id =
				node.attrs.id || generateHeadingId(text, pos);
			const slug = slugify(text);

			// Find parent in stack
			while (
				parentStack.length > 0 &&
				parentStack[parentStack.length - 1].level >= level
			) {
				parentStack.pop();
			}

			const parentId =
				parentStack.length > 0
					? parentStack[parentStack.length - 1].id
					: null;

			const item: OutlineItem = {
				id,
				text,
				level,
				pos,
				size: node.nodeSize,
				parentId,
				children: [],
				collapsed: node.attrs.collapsed ?? false,
				slug,
			};

			items.set(id, item);
			flat.push(item);

			if (parentId) {
				const parent = items.get(parentId);
				if (parent) {
					parent.children.push(id);
				}
			} else {
				roots.push(id);
			}

			parentStack.push({ id, level });
		}

		return true;
	});

	// Compute word counts for each section
	for (let i = 0; i < flat.length; i++) {
		const item = flat[i];
		const sectionStart = item.pos + item.size;
		const sectionEnd =
			i + 1 < flat.length ? flat[i + 1].pos : doc.content.size;
		const sectionText = doc.textBetween(sectionStart, sectionEnd, " ");
		item.wordCount = sectionText.trim()
			? sectionText.trim().split(/\s+/).length
			: 0;
	}

	return { items, roots, flat };
}

/**
 * Create decorations for outline (section numbers, etc.)
 */
function createDecorations(
	doc: ProseMirrorNode,
	outline: DocumentOutline,
	options: OutlineOptions
): DecorationSet {
	const decorations: Decoration[] = [];

	if (!options.showSectionNumbers) {
		return DecorationSet.empty;
	}

	// Build section number mapping
	const sectionNumbers = new Map<string, string>();
	const counters: number[] = [0, 0, 0, 0, 0, 0];

	for (const item of outline.flat) {
		const level = item.level - 1; // 0-indexed
		counters[level]++;
		// Reset deeper counters
		for (let i = level + 1; i < 6; i++) {
			counters[i] = 0;
		}
		// Build section number
		const number = counters
			.slice(0, level + 1)
			.filter((n) => n > 0)
			.join(".");
		sectionNumbers.set(item.id, number);
	}

	// Add decorations for section numbers
	doc.descendants((node, pos) => {
		if (node.type.name === "heading") {
			const id = node.attrs.id;
			if (id && sectionNumbers.has(id)) {
				const number = sectionNumbers.get(id)!;
				const span = document.createElement("span");
				span.className = "outline-section-number";
				span.textContent = `${number}. `;
				span.style.cssText =
					"color: var(--outline-number-color, #6b7280); margin-right: 0.5em; user-select: none;";
				decorations.push(
					Decoration.widget(pos + 1, () => span, {
						side: -1,
						key: `section-number-${id}`,
					})
				);
			}
		}
		return true;
	});

	return DecorationSet.create(doc, decorations);
}

/**
 * Outline Extension - Tracks document structure and provides outline functionality
 *
 * @example
 * const editor = new Editor({
 *   extensions: [
 *     StarterKit,
 *     Outline.configure({
 *       maxDepth: 3,
 *       onOutlineChange: (outline) => console.log(outline),
 *     }),
 *   ],
 * });
 *
 * // Get outline
 * const outline = editor.storage.outline.getOutline();
 */
export const Outline = Extension.create<OutlineOptions>({
	name: "outline",

	addOptions() {
		return {
			maxDepth: 6,
			minDepth: 1,
			autoAssignIds: true,
			showSectionNumbers: false,
		};
	},

	addStorage() {
		const outline: DocumentOutline = {
			items: new Map(),
			roots: [],
			flat: [],
		};

		return {
			outline,
			getOutline: (): DocumentOutline => outline,
			getItemById: (id: string): OutlineItem | undefined =>
				outline.items.get(id),
			getCurrentSection: (pos: number): OutlineItem | null => {
				const { flat } = outline;
				// Find the section containing this position
				for (let i = flat.length - 1; i >= 0; i--) {
					if (flat[i].pos <= pos) {
						return flat[i];
					}
				}
				return null;
			},
		};
	},

	addProseMirrorPlugins() {
		const extensionOptions = this.options;

		const plugin = new Plugin<OutlinePluginState>({
			key: outlinePluginKey,

			state: {
				init(_, { doc }) {
					const outline = extractOutline(doc, extensionOptions);
					const decorations = createDecorations(
						doc,
						outline,
						extensionOptions
					);
					return { outline, decorations };
				},

				apply(tr, value, _oldState, newState) {
					let { outline, decorations } = value;

					// Re-extract outline if document changed
					if (tr.docChanged) {
						outline = extractOutline(newState.doc, extensionOptions);
						decorations = createDecorations(
							newState.doc,
							outline,
							extensionOptions
						);
					} else {
						// Just map decorations
						decorations = decorations.map(tr.mapping, newState.doc);
					}

					return { outline, decorations };
				},
			},

			props: {
				decorations(state) {
					return this.getState(state)?.decorations ?? DecorationSet.empty;
				},
			},
		});

		return [plugin];
	},

	onUpdate() {
		const pluginState = outlinePluginKey.getState(this.editor.state);
		if (pluginState) {
			// Update storage
			this.storage.outline = pluginState.outline;
			// Notify listeners
			this.options.onOutlineChange?.(pluginState.outline);
		}
	},

	onCreate() {
		const pluginState = outlinePluginKey.getState(this.editor.state);
		if (pluginState) {
			this.storage.outline = pluginState.outline;
			this.options.onOutlineChange?.(pluginState.outline);
		}
	},
});

/**
 * Hook to get outline from editor
 */
export function getEditorOutline(editor: Editor): DocumentOutline {
	return (
		(editor.storage.outline as DocumentOutline) ?? {
			items: new Map(),
			roots: [],
			flat: [],
		}
	);
}

/**
 * Navigate to a heading position in the editor
 */
export function navigateToHeading(
	editor: Editor,
	item: OutlineItem
): boolean {
	return editor.commands.focus(item.pos + 1);
}

/**
 * Toggle section folding (if a fold extension is present)
 */
export function toggleSectionCollapse(
	editor: Editor,
	item: OutlineItem
): boolean {
	const { state, dispatch } = editor.view;
	const { tr } = state;
	const node = state.doc.nodeAt(item.pos);

	if (node && node.type.name === "heading") {
		const collapsed = !(node.attrs.collapsed ?? false);
		tr.setNodeMarkup(item.pos, undefined, {
			...node.attrs,
			collapsed,
		});
		dispatch(tr);
		return true;
	}
	return false;
}

/**
 * Get the content range for a section in the document.
 * The range extends from the heading position to the next heading
 * at the same or higher level, or to the end of the document.
 *
 * @param editor - Tiptap editor instance
 * @param item - The outline item representing the section
 * @returns Range {from, to} or null if not found
 *
 * @example
 * const range = getSectionRange(editor, outlineItem);
 * if (range) {
 *   editor.commands.setTextSelection(range);
 * }
 */
export function getSectionRange(
	editor: Editor,
	item: OutlineItem
): { from: number; to: number } | null {
	const { doc } = editor.state;

	// Start from the heading position
	const from = item.pos;
	let to = from + item.size;

	// Find the next heading at same or higher level to determine section end
	doc.nodesBetween(to, doc.content.size, (node, pos) => {
		if (node.type.name === "heading" && pos > from) {
			const level = node.attrs.level as number;
			if (level <= item.level) {
				// Found next heading at same or higher level
				return false; // Stop traversal
			}
		}
		// Update 'to' to include this node's content
		to = Math.max(to, pos + node.nodeSize);
		return true;
	});

	return { from, to };
}

/**
 * Select a section in the editor.
 * This sets the text selection to the entire section range.
 *
 * @param editor - Tiptap editor instance
 * @param item - The outline item representing the section
 * @returns Whether the selection was set successfully
 *
 * @example
 * selectSection(editor, outlineItem); // Selects entire section
 */
export function selectSection(
	editor: Editor,
	item: OutlineItem
): boolean {
	const range = getSectionRange(editor, item);
	if (!range) return false;

	return editor.chain().focus().setTextSelection(range).run();
}

export default Outline;
