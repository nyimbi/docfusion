/**
 * Tiptap extension bundle for DocFusion.
 *
 * Configures and exports all editor extensions including:
 * - Core editing features (StarterKit, tables, images, etc.)
 * - Document structure features (Outline, DragDrop)
 * - AI commands (SlashCommand)
 */

import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Extension, type AnyExtension } from "@tiptap/core";

// Import custom extensions
import { Outline, type OutlineOptions } from "@/lib/editor/extensions/outline";
import { DragDrop, type DragDropOptions, type DropPosition } from "@/lib/editor/extensions/drag-drop";
import { Equation, InlineEquation } from "@/lib/editor/extensions/equation";
import { ExternalFile, type ExternalFileAttributes } from "@/lib/editor/extensions/external-file";

/**
 * Custom extension to handle slash command trigger.
 * Detects when user types "/" and opens command palette.
 */
export const SlashCommandTrigger = Extension.create({
	name: "slashCommandTrigger",

	addOptions() {
		return {
			onSlashCommand: () => {},
		};
	},

	addKeyboardShortcuts() {
		return {
			"/": ({ editor }) => {
				// Only trigger at start of line or after space
				const { $from } = editor.state.selection;
				const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
				const isStartOfLine = textBefore.length === 0;
				const isAfterSpace = textBefore.endsWith(" ");

				if (isStartOfLine || isAfterSpace) {
					this.options.onSlashCommand();
					return false; // Allow "/" to be typed
				}

				return false;
			},
		};
	},
});

/**
 * Configuration options for the extension bundle.
 */
export interface EditorExtensionOptions {
	/** Placeholder text when editor is empty */
	placeholder?: string;
	/** Callback when "/" is pressed to open command palette */
	onSlashCommand?: () => void;
	/** Enable collaboration features (requires Yjs) */
	enableCollaboration?: boolean;
	/** Enable outline tracking */
	enableOutline?: boolean;
	/** Outline-specific configuration */
	outlineOptions?: Partial<OutlineOptions>;
	/** Enable drag-and-drop reordering */
	enableDragDrop?: boolean;
	/** Drag-drop-specific configuration */
	dragDropOptions?: Partial<DragDropOptions>;
	/** Callback when outline changes */
	onOutlineChange?: (outline: ReturnType<typeof Outline["storage"]["getOutline"]> ) => void;
	/** Callback when a drop is performed */
	onDrop?: (source: Parameters<NonNullable<DragDropOptions["onDrop"]>>[0], target: DropPosition) => boolean;
	/** Callback for handling file uploads - receives File, returns URL */
	onFileUpload?: (file: File) => Promise<string>;
}

// Re-export for convenience
export type { DropPosition } from "@/lib/editor/extensions/drag-drop";

/**
 * Create the standard extension bundle.
 */
export function createExtensions(options: EditorExtensionOptions = {}) {
	const {
		placeholder = "Start writing, or type '/' for commands...",
		onSlashCommand = () => {},
		enableOutline = true,
		outlineOptions = {},
		enableDragDrop = true,
		dragDropOptions = {},
		onOutlineChange,
		onDrop,
		onFileUpload,
	} = options;

	const extensions: AnyExtension[] = [
		// Core editing features
		StarterKit.configure({
			// Disable history if using collaboration (Yjs handles it)
			history: options.enableCollaboration ? false : undefined,
			// Configure heading levels
			heading: {
				levels: [1, 2, 3, 4, 5, 6],
			},
			// Configure code blocks
			codeBlock: {
				HTMLAttributes: {
					class: "rounded bg-gray-100 dark:bg-gray-800 p-4 font-mono text-sm",
				},
			},
			// Configure blockquotes
			blockquote: {
				HTMLAttributes: {
					class: "border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic",
				},
			},
		}),

		// Placeholder text
		Placeholder.configure({
			placeholder,
			emptyEditorClass: "is-editor-empty",
			showOnlyWhenEditable: true,
		}),

		// Additional text formatting
		Underline,

		// Link support
		Link.configure({
			openOnClick: false, // Don't open on click in editor
			HTMLAttributes: {
				class: "text-blue-600 dark:text-blue-400 underline cursor-pointer",
				rel: "noopener noreferrer nofollow",
			},
		}),

		// Image support
		Image.configure({
			HTMLAttributes: {
				class: "max-w-full h-auto rounded",
			},
			allowBase64: true,
		}),

		// Table support
		Table.configure({
			resizable: true,
			HTMLAttributes: {
				class: "border-collapse w-full",
			},
		}),
		TableRow,
		TableCell.configure({
			HTMLAttributes: {
				class: "border border-gray-300 dark:border-gray-600 p-2",
			},
		}),
		TableHeader.configure({
			HTMLAttributes: {
				class:
					"border border-gray-300 dark:border-gray-600 p-2 bg-gray-100 dark:bg-gray-800 font-semibold",
			},
		}),

		// Text alignment
		TextAlign.configure({
			types: ["heading", "paragraph"],
		}),

		// Highlight/mark text
		Highlight.configure({
			multicolor: true,
		}),

		// Task lists (checkboxes)
		TaskList.configure({
			HTMLAttributes: {
				class: "list-none pl-0",
			},
		}),
		TaskItem.configure({
			nested: true,
			HTMLAttributes: {
				class: "flex items-start gap-2",
			},
		}),

		// Typography improvements (smart quotes, etc.)
		Typography,

		// Text color and styling
		TextStyle,
		Color.configure({
			types: ["textStyle"],
		}),

		// Subscript/Superscript for equations and citations
		Subscript,
		Superscript,

		// Math equations
		Equation,
		InlineEquation,

		// External file attachments
		ExternalFile.configure({
			onFileUpload: onFileUpload ?? (async (file) => {
				// Default fallback: create blob URL for local-only operation
				// Parent component should provide onFileUpload for server storage
				return URL.createObjectURL(file);
			}),
		}),

		// Slash command trigger
		SlashCommandTrigger.configure({
			onSlashCommand,
		}),
	];

	// Add outline extension if enabled
	if (enableOutline) {
		extensions.push(
			Outline.configure({
				...outlineOptions,
				onOutlineChange,
			})
		);
	}

	// Add drag-drop extension if enabled
	if (enableDragDrop) {
		extensions.push(
			DragDrop.configure({
				...dragDropOptions,
				onDrop,
			})
		);
	}

	return extensions;
}

/**
 * Export individual extensions for custom configurations.
 */
export {
	StarterKit,
	Placeholder,
	Underline,
	Link,
	Image,
	Table,
	TableRow,
	TableCell,
	TableHeader,
	TextAlign,
	Highlight,
	TaskList,
	TaskItem,
	Typography,
	Color,
	TextStyle,
	Subscript,
	Superscript,
	Equation,
	InlineEquation,
	ExternalFile,
	Outline,
	DragDrop,
};

export type { ExternalFileAttributes };
