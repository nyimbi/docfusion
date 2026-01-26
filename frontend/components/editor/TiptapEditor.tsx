"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { createExtensions } from "./extensions";
import { EditorToolbar } from "./EditorToolbar";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useAIStore } from "@/lib/stores/ai-store";
import type { DocumentContent } from "@/lib/types/document";

/**
 * Props for the TiptapEditor component.
 */
interface TiptapEditorProps {
	/** Initial content (ProseMirror JSON format) */
	content?: DocumentContent;
	/** Called when content changes */
	onContentChange?: (content: DocumentContent) => void;
	/** Called when plain text changes (for word count, etc.) */
	onTextChange?: (text: string) => void;
	/** Called when the editor is ready */
	onEditorReady?: (editor: Editor) => void;
	/** Whether the editor is read-only */
	readOnly?: boolean;
	/** Placeholder text */
	placeholder?: string;
	/** Custom class for the editor container */
	className?: string;
	/** Whether to show the toolbar */
	showToolbar?: boolean;
	/** Whether to auto-focus on mount */
	autoFocus?: boolean;
}

/**
 * TiptapEditor component - the main rich text editor.
 *
 * Features:
 * - Rich text formatting (bold, italic, headings, lists, etc.)
 * - Slash commands for AI features
 * - Real-time collaboration ready (via Yjs extensions)
 * - Markdown import/export
 *
 * @example
 * <TiptapEditor
 *   content={document.content}
 *   onContentChange={handleContentChange}
 *   showToolbar
 * />
 */
export function TiptapEditor({
	content,
	onContentChange,
	onTextChange,
	onEditorReady,
	readOnly = false,
	placeholder = "Start writing, or type '/' for commands...",
	className,
	showToolbar = true,
	autoFocus = false,
}: TiptapEditorProps) {
	const openAICommandPalette = useAIStore((s) => s.openCommandPalette);
	const setSelection = useEditorStore((s) => s.setSelection);
	const preferences = useEditorStore((s) => s.preferences);

	// Create editor instance
	const editor = useEditor({
		extensions: createExtensions({
			placeholder,
			onSlashCommand: openAICommandPalette,
			enableCollaboration: false, // Enable when adding Yjs
		}),
		content: content ?? { type: "doc", content: [{ type: "paragraph" }] },
		editable: !readOnly,
		autofocus: autoFocus ? "end" : false,
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-gray dark:prose-invert max-w-none",
					"focus:outline-none min-h-[300px] p-6"
				),
				style: `font-size: ${preferences.fontSize}px; line-height: ${preferences.lineHeight};`,
				spellcheck: String(preferences.spellCheck),
			},
		},
		onUpdate: ({ editor }) => {
			// Emit content changes
			const json = editor.getJSON();
			onContentChange?.(json);

			// Emit plain text for word count
			const text = editor.getText();
			onTextChange?.(text);
		},
		onSelectionUpdate: ({ editor }) => {
			// Update selection state in store
			const { from, to } = editor.state.selection;
			const hasSelection = from !== to;
			const text = hasSelection ? editor.state.doc.textBetween(from, to) : "";
			setSelection(hasSelection, text, hasSelection ? { from, to } : null);
		},
		onCreate: ({ editor }) => {
			onEditorReady?.(editor);
		},
	});

	// Update content when prop changes (for external updates)
	React.useEffect(() => {
		if (editor && content && !editor.isDestroyed) {
			const currentContent = editor.getJSON();
			// Only update if content actually changed
			if (JSON.stringify(currentContent) !== JSON.stringify(content)) {
				editor.commands.setContent(content as Parameters<typeof editor.commands.setContent>[0]);
			}
		}
	}, [editor, content]);

	// Update editable state
	React.useEffect(() => {
		if (editor && !editor.isDestroyed) {
			editor.setEditable(!readOnly);
		}
	}, [editor, readOnly]);

	// Update editor styles when preferences change
	React.useEffect(() => {
		if (editor && !editor.isDestroyed) {
			const element = editor.view.dom;
			element.style.fontSize = `${preferences.fontSize}px`;
			element.style.lineHeight = String(preferences.lineHeight);
		}
	}, [editor, preferences.fontSize, preferences.lineHeight]);

	return (
		<div className={cn("flex flex-col h-full bg-white dark:bg-gray-950", className)}>
			{/* Toolbar */}
			{showToolbar && <EditorToolbar editor={editor} />}

			{/* Editor content */}
			<div className="flex-1 overflow-auto">
				<EditorContent
					editor={editor}
					className={cn(
						"h-full",
						// Add editor-specific styles
						"[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
						"[&_.is-editor-empty:first-child::before]:text-gray-400",
						"[&_.is-editor-empty:first-child::before]:dark:text-gray-500",
						"[&_.is-editor-empty:first-child::before]:float-left",
						"[&_.is-editor-empty:first-child::before]:h-0",
						"[&_.is-editor-empty:first-child::before]:pointer-events-none"
					)}
				/>
			</div>
		</div>
	);
}

/**
 * Hook to access the editor instance from context.
 * Use this in child components that need editor access.
 */
const EditorContext = React.createContext<Editor | null>(null);

export function EditorProvider({
	editor,
	children,
}: {
	editor: Editor | null;
	children: React.ReactNode;
}) {
	return (
		<EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
	);
}

export function useEditorContext() {
	const editor = React.useContext(EditorContext);
	if (!editor) {
		throw new Error("useEditorContext must be used within an EditorProvider");
	}
	return editor;
}

/**
 * Hook to get editor instance (safe version that returns null).
 */
export function useEditorContextSafe() {
	return React.useContext(EditorContext);
}

/**
 * Utility to convert Tiptap JSON to plain text.
 */
export function contentToText(content: DocumentContent): string {
	if (!content.content) return "";

	function extractText(nodes: DocumentContent["content"]): string {
		return (nodes ?? [])
			.map((node) => {
				if (node.type === "text") return node.content ?? "";
				if (node.type === "paragraph") return extractText(node.children) + "\n";
				if (node.type === "heading") return extractText(node.children) + "\n\n";
				if (node.children) return extractText(node.children);
				return "";
			})
			.join("");
	}

	return extractText(content.content).trim();
}

export type { Editor };
