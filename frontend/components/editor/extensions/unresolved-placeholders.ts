import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const PLACEHOLDER_PATTERN = /\{\{\s*[a-zA-Z_][\w.]*\s*\}\}/g;

export function findUnresolvedPlaceholderRanges(doc: PMNode) {
	const decorations: Decoration[] = [];

	doc.descendants((node, pos) => {
		if (!node.isText || !node.text) return;
		for (const match of node.text.matchAll(PLACEHOLDER_PATTERN)) {
			const start = pos + (match.index ?? 0);
			const end = start + match[0].length;
			decorations.push(
				Decoration.inline(start, end, {
					class: "unresolved-placeholder bg-amber-100 text-amber-900 ring-1 ring-amber-300 rounded px-0.5",
					"data-placeholder": match[0],
				})
			);
		}
	});

	return decorations;
}

export const UnresolvedPlaceholders = Extension.create({
	name: "unresolvedPlaceholders",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("unresolvedPlaceholders"),
				props: {
					decorations(state) {
						return DecorationSet.create(state.doc, findUnresolvedPlaceholderRanges(state.doc));
					},
				},
			}),
		];
	},
});

export default UnresolvedPlaceholders;
