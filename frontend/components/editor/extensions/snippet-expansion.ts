/**
 * Snippet Expansion Extension for Tiptap.
 *
 * Expands known "/shortcut" text after Space or Enter. Plain "/" remains owned
 * by the command palette; unknown shortcuts do not delete user input.
 */

import { Extension, type Editor } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import type { DocumentContent } from "@/lib/types/document";
import type { ShortcutExpansion, SnippetSummary } from "@/lib/types/snippets";

export interface SnippetExpansionOptions {
	onShortcutExpand?: (shortcut: string) => Promise<ShortcutExpansion | null>;
	onShortcutResolve: (shortcut: string) => Promise<SnippetSummary | null>;
	onGetSnippetContent: (snippet: SnippetSummary) => Promise<DocumentContent | ShortcutExpansion | null>;
	triggerChar?: string;
	expansionTriggers?: string[];
	minShortcutLength?: number;
	maxShortcutLength?: number;
	onExpand?: (shortcut: string, snippet: SnippetSummary, expansion?: ShortcutExpansion) => void;
	onError?: (shortcut: string, error: Error) => void;
}

interface ShortcutMatch {
	shortcutName: string;
	rangeText: string;
}

function findShortcut(textBefore: string, options: SnippetExpansionOptions): ShortcutMatch | null {
	const pattern = new RegExp(
		`(${options.triggerChar!})([a-zA-Z0-9_-]{${options.minShortcutLength},${options.maxShortcutLength}})$`
	);
	const match = textBefore.match(pattern);
	if (!match) return null;
	return {
		shortcutName: match[2],
		rangeText: match[0],
	};
}

async function resolveExpansion(
	shortcutName: string,
	options: SnippetExpansionOptions
): Promise<ShortcutExpansion | null> {
	if (options.onShortcutExpand) {
		return options.onShortcutExpand(shortcutName);
	}

	const snippet = await options.onShortcutResolve(shortcutName);
	if (!snippet) return null;

	const result = await options.onGetSnippetContent(snippet);
	if (!result) return null;

	if ("content" in result && "snippet" in result) {
		return result as ShortcutExpansion;
	}

	return {
		snippet,
		content: result as DocumentContent,
	};
}

function contentToNodes(editor: Editor, content: DocumentContent): PMNode[] {
	const nodes: PMNode[] = [];
	if (content.type === "doc" && Array.isArray(content.content)) {
		for (const nodeJson of content.content) {
			try {
				nodes.push(editor.schema.nodeFromJSON(nodeJson));
			} catch (error) {
				console.warn("Failed to parse snippet node:", nodeJson, error);
			}
		}
	} else if (content.type) {
		try {
			nodes.push(editor.schema.nodeFromJSON(content));
		} catch (error) {
			console.warn("Failed to parse snippet content:", content, error);
		}
	}
	return nodes;
}

export const SnippetExpansion = Extension.create<SnippetExpansionOptions>({
	name: "snippetExpansion",

	addOptions() {
		return {
			triggerChar: "/",
			expansionTriggers: [" ", "\n"],
			minShortcutLength: 1,
			maxShortcutLength: 50,
			onShortcutResolve: async () => null,
			onGetSnippetContent: async () => null,
		};
	},

	addProseMirrorPlugins() {
		const editor = this.editor;
		const options = this.options;

		const expandAtRange = async (
			view: EditorView,
			shortcutName: string,
			shortcutStart: number,
			shortcutEnd: number,
			appendParagraph: boolean
		): Promise<boolean> => {
			const expansion = await resolveExpansion(shortcutName, options);
			if (!expansion) return false;

			const nodes = contentToNodes(editor, expansion.content);
			if (nodes.length === 0) return false;

			const nodesToInsert = [...nodes];
			if (appendParagraph) {
				const paragraphNode = editor.schema.nodes.paragraph?.create();
				if (paragraphNode) {
					nodesToInsert.push(paragraphNode);
				}
			}

			const tr = view.state.tr.replaceWith(shortcutStart, shortcutEnd, nodesToInsert);
			if (appendParagraph && nodesToInsert.length > nodes.length) {
				const paragraphPos =
					shortcutStart + nodes.reduce((position, node) => position + node.nodeSize, 0);
				tr.setSelection(Selection.near(tr.doc.resolve(paragraphPos)));
			}

			view.dispatch(tr);
			options.onExpand?.(shortcutName, expansion.snippet, expansion);
			return true;
		};

		return [
			new Plugin({
				key: new PluginKey("snippetExpansion"),
				props: {
					handleTextInput: (view: EditorView, from: number, to: number, text: string) => {
						if (!options.expansionTriggers?.includes(text)) return false;

						const { $from } = view.state.selection;
						const maxLookback = options.maxShortcutLength! + 1;
						const textBefore = $from.parent.textBetween(
							Math.max(0, $from.parentOffset - maxLookback),
							$from.parentOffset
						);
						const match = findShortcut(textBefore, options);
						if (!match) return false;

						let shortcutStart = from - match.rangeText.length;
						let shortcutEnd = to;
						if ($from.parent.textContent === match.rangeText && $from.depth > 0) {
							shortcutStart = $from.before();
							shortcutEnd = $from.after();
						}

						Promise.resolve()
							.then(async () => {
								const expanded = await expandAtRange(
									view,
									match.shortcutName,
									shortcutStart,
									shortcutEnd,
									false
								);
								if (!expanded) {
									view.dispatch(view.state.tr.insertText(text, from, to));
								}
							})
							.catch((error) => {
								console.error("Snippet expansion error:", error);
								options.onError?.(match.shortcutName, error as Error);
								view.dispatch(view.state.tr.insertText(text, from, to));
							});

						return true;
					},

					handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
						if (event.key !== "Enter") return false;

						const { $from } = view.state.selection;
						const maxLookback = options.maxShortcutLength! + 1;
						const textBefore = $from.parent.textBetween(
							Math.max(0, $from.parentOffset - maxLookback),
							$from.parentOffset
						);
						const match = findShortcut(textBefore, options);
						if (!match) return false;

						event.preventDefault();
						let shortcutStart = $from.pos - match.rangeText.length;
						let shortcutEnd = $from.pos;
						if ($from.parent.textContent === match.rangeText && $from.depth > 0) {
							shortcutStart = $from.before();
							shortcutEnd = $from.after();
						}

						Promise.resolve()
							.then(async () => {
								const expanded = await expandAtRange(
									view,
									match.shortcutName,
									shortcutStart,
									shortcutEnd,
									true
								);
								if (!expanded) {
									editor.chain().focus().insertContent("\n").run();
								}
							})
							.catch((error) => {
								console.error("Snippet expansion error:", error);
								options.onError?.(match.shortcutName, error as Error);
								editor.chain().focus().insertContent("\n").run();
							});

						return true;
					},
				},
			}),
		];
	},
});

export default SnippetExpansion;
